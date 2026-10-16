export type Charge = { date: string; amount: number; name: string };

export type Subscription = {
  name: string;
  amount: number;
  period: 'monthly' | 'yearly';
  lastDate: string;
  nextDate: string;
  count: number;
};

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

function asSubscription(cluster: Charge[], today: string): Subscription | null {
  const sorted = [...cluster].sort((a, b) => a.date.localeCompare(b.date));
  const gaps = sorted.slice(1).map((c, i) => days(sorted[i].date, c.date));
  if (gaps.length === 0) return null;

  let period: Subscription['period'] | null = null;
  if (sorted.length >= 3 && isRegular(gaps, 30.4, 5)) period = 'monthly';
  else if (sorted.length >= 2 && isRegular(gaps, 365, 15)) period = 'yearly';
  if (!period) return null;

  const last = sorted.at(-1)!;
  const allowedSilence = period === 'monthly' ? 45 : 400;
  if (days(last.date, today) > allowedSilence) return null;

  return {
    name: last.name,
    amount: Math.round(median(sorted.map(c => c.amount))),
    period,
    lastDate: last.date,
    nextDate: addPeriod(last.date, period),
    count: sorted.length,
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
    for (const cluster of clusterByAmount(merchantCharges)) {
      const subscription = asSubscription(cluster, today);
      if (subscription) found.push(subscription);
    }
  }
  return found.sort((a, b) => monthlyCost(b) - monthlyCost(a));
}

export function monthlyCost(subscription: Subscription) {
  return subscription.period === 'monthly'
    ? subscription.amount
    : subscription.amount / 12;
}
