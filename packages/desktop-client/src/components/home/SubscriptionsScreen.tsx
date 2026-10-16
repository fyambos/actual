import React, { useMemo } from 'react';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';

import { usePayeesById } from '#hooks/usePayees';

import { categoryLook, radius } from './design';
import { Card, ScreenHeader, SectionTitle } from './layout';
import { detectSubscriptions, merchantName, monthlyCost } from './recurring';
import { useLayoutMode } from './responsive';
import { formatAmount, useSpending } from './spending';

const shortDate = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
});

function MerchantAvatar({ name }: { name: string }) {
  const { color } = categoryLook(name);
  return (
    <View
      style={{
        width: 42,
        height: 42,
        flexShrink: 0,
        borderRadius: radius.tile,
        backgroundColor: `${color}22`,
        color,
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        fontWeight: 700,
      }}
    >
      {name.charAt(0).toUpperCase()}
    </View>
  );
}

export function SubscriptionsScreen() {
  const today = monthUtils.currentDay();
  const mode = useLayoutMode();
  const since = monthUtils.subDays(today, 400);
  const { transactions } = useSpending({ date: { $gte: since } });
  const { data: payees } = usePayeesById();

  const subscriptions = useMemo(() => {
    const charges = transactions
      .filter(t => t.payee && payees?.[t.payee])
      .map(t => ({
        date: t.date,
        amount: -t.amount,
        name: merchantName(payees![t.payee!].name),
      }));
    return detectSubscriptions(charges, today);
  }, [transactions, payees, today]);

  const perMonth = subscriptions.reduce((sum, s) => sum + monthlyCost(s), 0);

  return (
    <View style={{ gap: 16 }}>
      <ScreenHeader overline="Repérés dans tes dépenses" title="Abonnements" />

      <Card
        style={{
          flexDirection: 'row',
          gap: 10,
          padding: 10,
          maxWidth: mode === 'phone' ? undefined : 560,
        }}
      >
        {[
          ['Par mois', perMonth],
          ['Par an', perMonth * 12],
        ].map(([label, value]) => (
          <View
            key={label}
            style={{
              flex: 1,
              gap: 4,
              padding: 14,
              borderRadius: 18,
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
            }}
          >
            <Text style={{ fontSize: 13, color: theme.pageTextSubdued }}>
              {label}
            </Text>
            <Text
              style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.6 }}
            >
              {formatAmount(Math.round(value as number))}
            </Text>
          </View>
        ))}
      </Card>

      <SectionTitle>{subscriptions.length} abonnements actifs</SectionTitle>
      <Card
        style={{
          padding: 6,
          display: mode === 'phone' ? 'flex' : 'grid',
          gridTemplateColumns:
            mode === 'desktop' ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
          columnGap: 8,
        }}
      >
        {subscriptions.length === 0 ? (
          <Text
            style={{ padding: 16, color: theme.pageTextSubdued, fontSize: 15 }}
          >
            Aucun paiement régulier repéré pour l'instant.
          </Text>
        ) : (
          subscriptions.map(s => (
            <View
              key={`${s.name}-${s.amount}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
              }}
            >
              <MerchantAvatar name={s.name} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={{ fontSize: 16, fontWeight: 500 }}>{s.name}</Text>
                <Text style={{ fontSize: 13, color: theme.pageTextSubdued }}>
                  Prochain :{' '}
                  {shortDate.format(new Date(`${s.nextDate}T12:00:00`))}
                  {s.period === 'yearly' ? ' · par an' : ''}
                </Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: 600 }}>
                {formatAmount(s.amount)}
              </Text>
            </View>
          ))
        )}
      </Card>
    </View>
  );
}
