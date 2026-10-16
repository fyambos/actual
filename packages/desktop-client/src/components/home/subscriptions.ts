import { useMemo } from 'react';

import * as monthUtils from '@actual-app/core/shared/months';
import type { TransactionEntity } from '@actual-app/core/types/models';

import { useCategoriesById } from '#hooks/useCategories';
import { usePayeesById } from '#hooks/usePayees';

import {
  detectSubscriptions,
  matchesSubscription,
  merchantName,
} from './recurring';
import { useSpending } from './spending';

const SUBSCRIPTIONS_GROUP = 'Abonnements';

// How far back plans are looked for, so ended ones show too.
const HISTORY_DAYS = 3 * 365;

// Plans found in the last three years of spending, active and ended: the Abonnements screen.
export function useSubscriptions() {
  const today = monthUtils.currentDay();
  const since = monthUtils.subDays(today, HISTORY_DAYS);
  const { transactions } = useSpending({ date: { $gte: since } });
  const { data: payees } = usePayeesById();
  const { data: categories } = useCategoriesById();

  return useMemo(() => {
    const charges = transactions
      .filter(t => t.payee && payees?.[t.payee])
      .map(t => ({
        date: t.date,
        amount: -t.amount,
        name: merchantName(payees![t.payee!].name),
        category: t.category ? categories?.list[t.category]?.name : null,
      }));
    return detectSubscriptions(charges, today);
  }, [transactions, payees, categories, today]);
}

// Tells subscription charges apart: filed under the Abonnements group, or a detected plan.
export function useIsSubscription() {
  const subscriptions = useSubscriptions();
  const { data: payees } = usePayeesById();
  const { data: categories } = useCategoriesById();

  return (t: TransactionEntity) => {
    const category = t.category ? categories?.list[t.category] : null;
    if (
      category &&
      categories?.grouped[category.group]?.name === SUBSCRIPTIONS_GROUP
    ) {
      return true;
    }
    const payee = t.payee ? payees?.[t.payee] : null;
    return (
      payee != null &&
      matchesSubscription(
        { name: merchantName(payee.name), amount: -t.amount },
        subscriptions,
      )
    );
  };
}
