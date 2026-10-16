// Finding the bank lines a hand-entered expense became.
//
// Bank sync already merges a manual entry with an imported line of the same account and the
// exact same amount within seven days. What is left over (a tip added later, a dollar purchase
// converted by PayPal, the wrong account, an order billed in several parts) lands here.

export type ReconcileTransaction = {
  id: string;
  date: string;
  amount: number;
  account: string;
  label: string;
};

export type Candidate = {
  transactions: ReconcileTransaction[];
  score: number;
  exact: boolean;
};

const DAY = 86_400_000;

function toTime(date: string) {
  return Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
  );
}

function toDate(time: number) {
  return new Date(time).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  return Math.round((toTime(to) - toTime(from)) / DAY);
}

export function addBusinessDays(date: string, days: number) {
  let time = toTime(date);
  let left = days;
  while (left > 0) {
    time += DAY;
    const weekday = new Date(time).getUTCDay();
    if (weekday !== 0 && weekday !== 6) left--;
  }
  return toDate(time);
}

// A manual entry is worth looking at once the bank had `days` working days to report it.
export function isOverdue(date: string, today: string, days: number) {
  return addBusinessDays(date, days) <= today;
}

function words(label: string) {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(word => word.length >= 3);
}

function sharesWord(a: string, b: string) {
  const other = new Set(words(b));
  return words(a).some(word => other.has(word));
}

// Bank lines up to 3 days before and 10 days after the entry can be the same spending.
const BEFORE = 3;
const AFTER = 10;

export function findCandidates(
  manual: ReconcileTransaction,
  bank: ReconcileTransaction[],
  limit = 5,
): Candidate[] {
  const nearby = bank.filter(b => {
    const gap = daysBetween(manual.date, b.date);
    return (
      gap >= -BEFORE &&
      gap <= AFTER &&
      Math.sign(b.amount) === Math.sign(manual.amount)
    );
  });

  const singles: Candidate[] = [];
  for (const b of nearby) {
    const difference = Math.abs(b.amount - manual.amount);
    const relative = difference / Math.abs(manual.amount);
    // A tip or a currency conversion moves the amount a little, not more.
    if (relative > 0.2 && difference > 200) continue;
    // On another account only the exact amount is a credible match.
    if (difference > 0 && b.account !== manual.account) continue;
    const gap = Math.abs(daysBetween(manual.date, b.date));
    singles.push({
      transactions: [b],
      exact: difference === 0,
      // The same amount to the cent outweighs a few days of delay.
      score:
        (difference === 0 ? -0.5 : 0) +
        relative * 4 +
        gap * 0.1 +
        (b.account === manual.account ? 0 : 1) -
        (sharesWord(manual.label, b.label) ? 0.5 : 0),
    });
  }

  // An order billed in several parts: two or three lines of the same account adding up exactly.
  const parts = nearby
    .filter(
      b =>
        b.account === manual.account &&
        Math.abs(b.amount) < Math.abs(manual.amount),
    )
    .sort(
      (a, b) =>
        Math.abs(daysBetween(manual.date, a.date)) -
        Math.abs(daysBetween(manual.date, b.date)),
    )
    .slice(0, 20);
  const combos: Candidate[] = [];
  const addCombo = (set: ReconcileTransaction[]) => {
    const gaps = set.map(b => Math.abs(daysBetween(manual.date, b.date)));
    const named = set.some(b => sharesWord(manual.label, b.label));
    combos.push({
      transactions: set,
      exact: true,
      score:
        -0.3 + set.length * 0.15 + Math.max(...gaps) * 0.1 - (named ? 0.5 : 0),
    });
  };
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      const pair = parts[i].amount + parts[j].amount;
      if (pair === manual.amount) addCombo([parts[i], parts[j]]);
      for (let k = j + 1; k < parts.length; k++) {
        if (pair + parts[k].amount === manual.amount) {
          addCombo([parts[i], parts[j], parts[k]]);
        }
      }
    }
  }

  return [...singles, ...combos]
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);
}
