import { useMemo } from 'react';

import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import type { TransactionEntity } from '@actual-app/core/types/models';

import { useCategoriesById } from '#hooks/useCategories';
import { usePayeesById } from '#hooks/usePayees';
import { useQuery } from '#hooks/useQuery';

import {
  detectSubscriptions,
  matchesSubscription,
  merchantName,
  withoutRefunded,
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

  const { data: credits } = useQuery<TransactionEntity>(
    () =>
      q('transactions')
        .filter({
          'account.offbudget': false,
          amount: { $gt: 0 },
          transfer_id: null,
          date: { $gte: since },
        })
        .select(['date', 'amount', 'payee'])
        .options({ splits: 'inline' }),
    [since],
  );

  return useMemo(() => {
    const named = (t: TransactionEntity, amount: number) => ({
      date: t.date,
      amount,
      name: merchantName(payees![t.payee!].name),
      category: t.category ? categories?.list[t.category]?.name : null,
    });
    const charges = transactions
      .filter(t => t.payee && payees?.[t.payee])
      .map(t => named(t, -t.amount));
    const refunds = (credits ?? [])
      .filter(t => t.payee && payees?.[t.payee])
      .map(t => named(t, t.amount));
    return detectSubscriptions(withoutRefunded(charges, refunds), today);
  }, [transactions, credits, payees, categories, today]);
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
