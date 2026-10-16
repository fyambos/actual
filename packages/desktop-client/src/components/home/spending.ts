import { q } from '@actual-app/core/shared/query';
import type { TransactionEntity } from '@actual-app/core/types/models';

import { useQuery } from '#hooks/useQuery';
import { useSyncedPref } from '#hooks/useSyncedPref';

const DEFAULT_DAILY_BUDGET = 10;
const DEFAULT_MONTHLY_BUDGET = 400;

const euros = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
});

const wholeEuros = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

export function formatAmount(cents: number) {
  // The interface font has no narrow no-break space, which French formatting uses for thousands.
  return (cents % 100 === 0 ? wholeEuros : euros)
    .format(cents / 100)
    .replace(/\u202f/g, '\u00a0');
}

// Money moved to savings or to the owner's other accounts is not spent.
const NOT_SPENDING = ['Épargne', 'Virements internes'];

// Money that left the budget: transfers between accounts and opening balances are not spending.
export function spendingQuery(filter: Record<string, unknown>) {
  return q('transactions')
    .filter({
      'account.offbudget': false,
      amount: { $lt: 0 },
      transfer_id: null,
      starting_balance_flag: false,
      $or: [
        { category: null },
        {
          $and: NOT_SPENDING.map(name => ({ 'category.name': { $ne: name } })),
        },
      ],
      ...filter,
    })
    .select('*')
    .options({ splits: 'inline' });
}

export function useSpending(filter: Record<string, unknown>) {
  // The filter object is rebuilt on every render; its JSON is the stable identity.
  const key = JSON.stringify(filter);
  const { data, isLoading } = useQuery<TransactionEntity>(
    () => spendingQuery(JSON.parse(key)),
    [key],
  );
  const transactions = data ?? [];
  const total = transactions.reduce((sum, t) => sum - t.amount, 0);
  return { transactions, total, isLoading };
}

function useBudgetPref(
  name: 'home-daily-budget' | 'home-monthly-budget',
  fallback: number,
) {
  const [value, setValue] = useSyncedPref(name);
  const parsed = Number(value);
  const euros = Number.isFinite(parsed) && value != null ? parsed : fallback;
  return [
    Math.round(euros * 100),
    (next: number) => setValue(String(next)),
  ] as const;
}

export function useDailyBudget() {
  return useBudgetPref('home-daily-budget', DEFAULT_DAILY_BUDGET);
}

export function useMonthlyBudget() {
  return useBudgetPref('home-monthly-budget', DEFAULT_MONTHLY_BUDGET);
}

// Monthly limits per category, stored as {categoryId: euros}; a category without one has none.
export function useCategoryBudgets() {
  const [value, setValue] = useSyncedPref('home-category-budgets');
  let euros: Record<string, number> = {};
  try {
    const parsed: unknown = JSON.parse(value ?? '{}');
    if (parsed && typeof parsed === 'object') {
      euros = parsed as Record<string, number>;
    }
  } catch {
    // A damaged value counts as no budgets.
  }
  const cents = Object.fromEntries(
    Object.entries(euros)
      .filter(([, amount]) => Number.isFinite(amount) && amount > 0)
      .map(([id, amount]) => [id, Math.round(amount * 100)]),
  );
  const setBudget = (categoryId: string, amount: number | null) => {
    const next = { ...euros };
    if (amount == null) delete next[categoryId];
    else next[categoryId] = amount;
    setValue(JSON.stringify(next));
  };
  return [cents, setBudget] as const;
}
