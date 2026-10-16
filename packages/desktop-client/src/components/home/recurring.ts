export type Charge = {
  date: string;
  amount: number;
  name: string;
  category?: string | null;
};

export type Subscription = {
  name: string;
  amount: number;
  period: 'monthly' | 'yearly';
  firstDate: string;
  lastDate: string;
  nextDate: string;
  count: number;
  // Total paid over the detected span.
  total: number;
  // Billed by usage (hosting, API): the amount changes every month.
  variable: boolean;
  active: boolean;
};

// Everyday spending recurs too (the same bakery, groceries every week) but is not a plan.
const EVERYDAY = new Set([
  'Supermarché / Épicerie',
  'Restaurants',
  'Fast foods',
  'Café',
]);
// One-off purchases can fall a year apart by chance; a yearly plan is never filed there.
const ONE_OFF = new Set([
  'Vêtements / Chaussures',
  'Achats et shopping - autres',
  'High Tech',
  'Cadeaux',
  'Livres',
  'Cosmétique',
  'Décoration',
  'Virements',
]);

// Categories of services billed every month, whatever the day.
const SERVICES = new Set(['Services en ligne', 'Abonnements - autres']);
const MONTHLY_SILENCE = 45;
const YEARLY_SILENCE = 400;

const DAY = 86_400_000;

// Card labels carry the invoice date, card digits and currency; the merchant is what's left.
export function merchantName(label: string) {
  return label
    .replace(/\s*\(EN [A-Z]{3} [\d ,.]+\)/, '')
    .replace(/\s+FACT \d{6}.*$/, '')
    .replace(/\s+\d{6}\*+\d*$/, '')
    .replace(/^(CB|PRLV|VIR SEPA|VIR INST)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function days(from: string, to: string) {
  return (Date.parse(to) - Date.parse(from)) / DAY;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function addPeriod(date: string, period: Subscription['period']) {
  const next = new Date(`${date}T12:00:00`);
  if (period === 'monthly') next.setMonth(next.getMonth() + 1);
  else next.setFullYear(next.getFullYear() + 1);
  return next.toISOString().slice(0, 10);
}

// Same merchant, amounts within 10% of each other: one plan, even when currency conversion wobbles.
function clusterByAmount(charges: Charge[]) {
  const clusters: Charge[][] = [];
  for (const charge of [...charges].sort((a, b) => a.amount - b.amount)) {
    const last = clusters.at(-1);
    if (
      last &&
      Math.abs(charge.amount - median(last.map(c => c.amount))) <=
        Math.abs(charge.amount) * 0.1
    ) {
      last.push(charge);
    } else {
      clusters.push([charge]);
    }
  }
  return clusters;
}

// Every gap is one period, or two when a single charge is missing, give or take a few days.
// Frequent everyday purchases fail this: their gaps are short and uneven.
function isRegular(gaps: number[], period: number, slack: number) {
  const periods = gaps.map(gap => Math.round(gap / period));
  const onBeat = gaps.every(
    (gap, i) =>
      periods[i] >= 1 &&
      periods[i] <= 2 &&
      Math.abs(gap - periods[i] * period) <= slack,
  );
  const missed = periods.filter(p => p === 2).length;
  return onBeat && missed <= 1;
}

function plan(
  sorted: Charge[],
  period: Subscription['period'],
  today: string,
): Subscription {
  const last = sorted.at(-1)!;
  const silence = period === 'monthly' ? MONTHLY_SILENCE : YEARLY_SILENCE;
  return {
    name: last.name,
    amount: Math.round(median(sorted.map(c => c.amount))),
    period,
    firstDate: sorted[0].date,
    lastDate: last.date,
    nextDate: addPeriod(last.date, period),
    count: sorted.length,
    total: sorted.reduce((sum, c) => sum + c.amount, 0),
    variable: false,
    active: days(last.date, today) <= silence,
  };
}

// The plans one price makes: each unbroken monthly stretch (a plan stopped and taken up again
// counts twice), or else a yearly charge when the merchant can bill yearly.
function asSubscriptions(
  cluster: Charge[],
  today: string,
  yearlyAllowed: boolean,
): Subscription[] {
  const sorted = [...cluster].sort((a, b) => a.date.localeCompare(b.date));
  const stretches: Charge[][] = [];
  for (const charge of sorted) {
    const current = stretches.at(-1);
    if (current && days(current.at(-1)!.date, charge.date) <= 70) {
      current.push(charge);
    } else {
      stretches.push([charge]);
    }
  }
  const monthly = stretches
    .filter(stretch => {
      const gaps = stretch
        .slice(1)
        .map((c, i) => days(stretch[i].date, c.date));
      return stretch.length >= 3 && isRegular(gaps, 30.4, 5);
    })
    .map(stretch => plan(stretch, 'monthly', today));
  if (monthly.length > 0) return monthly;

  const gaps = sorted.slice(1).map((c, i) => days(sorted[i].date, c.date));
  if (yearlyAllowed && sorted.length >= 2 && isRegular(gaps, 365, 15)) {
    return [plan(sorted, 'yearly', today)];
  }
  return [];
}

const monthOf = (date: string) => date.slice(0, 7);

function nextMonth(month: string) {
  const [year, m] = month.split('-').map(Number);
  return m === 12
    ? `${year + 1}-01`
    : `${year}-${String(m + 1).padStart(2, '0')}`;
}

// A usage-billed plan: charged every month for at least three months in a row, a few times a
// month at most, starting around the same day each month.
function asVariableSubscription(
  charges: Charge[],
  today: string,
): Subscription | null {
  const byMonth = new Map<string, Charge[]>();
  for (const c of [...charges].sort((a, b) => a.date.localeCompare(b.date))) {
    byMonth.set(monthOf(c.date), [...(byMonth.get(monthOf(c.date)) ?? []), c]);
  }
  const months = [...byMonth.keys()].sort();
  // The latest run of consecutive months.
  let run = [months.at(-1)!];
  for (let i = months.length - 2; i >= 0; i--) {
    if (nextMonth(months[i]) !== run[0]) break;
    run = [months[i], ...run];
  }
  if (run.length < 3) return null;

  const perMonth = run.map(m => byMonth.get(m)!);
  if (median(perMonth.map(list => list.length)) > 5) return null;
  const firstDays = perMonth.map(list => Number(list[0].date.slice(8, 10)));
  const usualDay = median(firstDays);
  // A service filed as such may bill on any day; anything else must keep its day.
  const service =
    charges.filter(c => SERVICES.has(c.category ?? '')).length >
    charges.length / 2;
  if (!service && firstDays.some(day => Math.abs(day - usualDay) > 3)) {
    return null;
  }

  const totals = perMonth.map(list => list.reduce((s, c) => s + c.amount, 0));
  const all = perMonth.flat();
  const last = all.at(-1)!;
  const nextDay = String(Math.round(usualDay)).padStart(2, '0');
  return {
    name: last.name,
    amount: Math.round(median(totals.slice(-3))),
    period: 'monthly',
    firstDate: all[0].date,
    lastDate: last.date,
    nextDate: `${nextMonth(monthOf(last.date))}-${nextDay}`,
    count: all.length,
    total: totals.reduce((s, t) => s + t, 0),
    variable: true,
    active: days(last.date, today) <= MONTHLY_SILENCE,
  };
}

export function detectSubscriptions(charges: Charge[], today: string) {
  const byMerchant = new Map<string, Charge[]>();
  for (const charge of charges) {
    const key = charge.name.toLowerCase();
    byMerchant.set(key, [...(byMerchant.get(key) ?? []), charge]);
  }
  const found: Subscription[] = [];
  for (const merchantCharges of byMerchant.values()) {
    const share = (set: Set<string>) =>
      merchantCharges.filter(c => set.has(c.category ?? '')).length /
      merchantCharges.length;
    if (share(EVERYDAY) > 0.5) continue;

    const yearlyAllowed = share(ONE_OFF) <= 0.5;
    const fixed = clusterByAmount(merchantCharges).flatMap(cluster => {
      const plans = asSubscriptions(cluster, today, yearlyAllowed);
      if (plans.length > 0) return plans;
      // Other fees of a similar amount can hide a plan billed at one exact price.
      const counts = new Map<number, number>();
      for (const c of cluster) {
        counts.set(c.amount, (counts.get(c.amount) ?? 0) + 1);
      }
      const [usual, count] = [...counts].sort((a, b) => b[1] - a[1])[0];
      return count >= 3 && count < cluster.length
        ? asSubscriptions(
            cluster.filter(c => c.amount === usual),
            today,
            yearlyAllowed,
          )
        : [];
    });
    const lastCharge = merchantCharges.reduce(
      (last, c) => (c.date > last ? c.date : last),
      '',
    );
    // No steady price, or the price drifted and the steady plan stopped matching: try usage.
    const drifted = fixed.every(s => days(s.lastDate, lastCharge) > 20);
    const variable = drifted
      ? asVariableSubscription(merchantCharges, today)
      : null;
    if (variable) {
      found.push(variable);
      continue;
    }
    // An earlier stretch of a plan still running is the same plan, not an ended one, and
    // ended stretches at one price are one ended plan.
    const samePrice = (a: Subscription, b: Subscription) =>
      Math.abs(a.amount - b.amount) <= Math.abs(a.amount) * 0.1;
    const running = fixed.filter(s => s.active);
    const ended: Subscription[] = [];
    for (const s of fixed.filter(f => !f.active)) {
      if (running.some(r => samePrice(r, s))) continue;
      const earlier = ended.find(e => samePrice(e, s));
      if (!earlier) {
        ended.push(s);
        continue;
      }
      earlier.firstDate =
        s.firstDate < earlier.firstDate ? s.firstDate : earlier.firstDate;
      earlier.lastDate =
        s.lastDate > earlier.lastDate ? s.lastDate : earlier.lastDate;
      earlier.total += s.total;
      earlier.count += s.count;
    }
    found.push(...running, ...ended);
  }
  return found.sort((a, b) => monthlyCost(b) - monthlyCost(a));
}

export function monthlyCost(subscription: Subscription) {
  return subscription.period === 'monthly'
    ? subscription.amount
    : subscription.amount / 12;
}

// A charge belongs to a plan when it has the plan's merchant and, unless the plan is billed by
// usage, an amount within 10% of it.
export function matchesSubscription(
  charge: Pick<Charge, 'name' | 'amount'>,
  subscriptions: Subscription[],
) {
  const name = charge.name.toLowerCase();
  return subscriptions.some(
    s =>
      s.name.toLowerCase() === name &&
      (s.variable ||
        Math.abs(charge.amount - s.amount) <= Math.abs(s.amount) * 0.1),
  );
}

// A charge refunded within a few days by the same merchant (a bank fee waived every month) costs
// nothing, so it does not make a plan.
export function withoutRefunded(charges: Charge[], refunds: Charge[]) {
  const used = new Set<Charge>();
  return charges.filter(charge => {
    const refund = refunds.find(
      r =>
        !used.has(r) &&
        r.name.toLowerCase() === charge.name.toLowerCase() &&
        r.amount >= charge.amount * 0.9 &&
        days(charge.date, r.date) >= 0 &&
        days(charge.date, r.date) <= 5,
    );
    if (refund) used.add(refund);
    return !refund;
  });
}
