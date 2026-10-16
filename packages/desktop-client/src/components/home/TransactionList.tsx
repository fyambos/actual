import React from 'react';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { TransactionEntity } from '@actual-app/core/types/models';
import { ArrowLeftRight } from 'lucide-react';

import { useCategoriesById } from '#hooks/useCategories';
import { usePayeesById } from '#hooks/usePayees';

import { accent, radius } from './design';
import { isPending } from './entries';
import { CategoryTile } from './layout';
import { merchantName } from './recurring';
import { formatAmount } from './spending';

const shortDate = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
});

const longDate = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

function Row({
  transaction: t,
  showDate,
  onSelect,
}: {
  transaction: TransactionEntity;
  showDate?: boolean;
  onSelect: (transaction: TransactionEntity) => void;
}) {
  const { data: payees } = usePayeesById();
  const { data: categories } = useCategoriesById();
  const transfer = Boolean(t.transfer_id);
  const category = t.category ? categories?.list[t.category]?.name : null;
  const payee = t.payee ? payees?.[t.payee] : null;
  const name = payee
    ? transfer
      ? `${t.amount < 0 ? 'Vers' : 'Depuis'} ${payee.name}`
      : merchantName(payee.name)
    : 'Sans nom';
  const details = [
    showDate ? shortDate.format(new Date(`${t.date}T12:00:00`)) : null,
    transfer ? (category ?? 'Virement') : (category ?? 'Sans catégorie'),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <button
      type="button"
      // A transfer has two sides; it is edited from the full Actual view.
      disabled={transfer}
      onClick={() => onSelect(t)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        border: 'none',
        borderRadius: 16,
        background: 'transparent',
        color: theme.pageText,
        textAlign: 'left',
        cursor: transfer ? 'default' : 'pointer',
        width: '100%',
      }}
    >
      {transfer ? (
        <View
          style={{
            width: 42,
            height: 42,
            flexShrink: 0,
            borderRadius: radius.tile,
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowLeftRight size={20} color={theme.pageTextSubdued} />
        </View>
      ) : (
        <CategoryTile name={category} />
      )}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 13, color: theme.pageTextSubdued }}>
            {details}
          </Text>
          {isPending(t) && !transfer && (
            <Text
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: accent,
                backgroundColor: `${accent}22`,
                borderRadius: radius.pill,
                padding: '2px 8px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
              title="Saisie à la main, pas encore confirmée par la banque"
            >
              en attente
            </Text>
          )}
        </View>
      </View>
      <Text
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: t.amount > 0 ? theme.numberPositive : theme.pageText,
        }}
      >
        {t.amount > 0 ? '+' : ''}
        {formatAmount(t.amount)}
      </Text>
    </button>
  );
}

export function TransactionList({
  transactions,
  showDate,
  groupByDay,
  empty,
  onSelect,
}: {
  transactions: readonly TransactionEntity[];
  showDate?: boolean;
  // Day headers with the day's net total, for long lists.
  groupByDay?: boolean;
  empty: string;
  onSelect: (transaction: TransactionEntity) => void;
}) {
  if (transactions.length === 0) {
    return (
      <Text style={{ padding: 16, color: theme.pageTextSubdued, fontSize: 15 }}>
        {empty}
      </Text>
    );
  }

  if (!groupByDay) {
    return (
      <>
        {transactions.map(t => (
          <Row
            key={t.id}
            transaction={t}
            showDate={showDate}
            onSelect={onSelect}
          />
        ))}
      </>
    );
  }

  const days: Array<[string, TransactionEntity[]]> = [];
  for (const t of transactions) {
    const last = days[days.length - 1];
    if (last && last[0] === t.date) last[1].push(t);
    else days.push([t.date, [t]]);
  }

  return (
    <>
      {days.map(([date, lines]) => {
        const net = lines.reduce((sum, t) => sum + t.amount, 0);
        return (
          <View key={date} style={{ gap: 2 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                padding: '14px 12px 4px',
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: theme.pageTextSubdued,
                }}
              >
                {longDate
                  .format(new Date(`${date}T12:00:00`))
                  .replace(/^./, c => c.toUpperCase())}
              </Text>
              <Text style={{ fontSize: 13, color: theme.pageTextSubdued }}>
                {net > 0 ? '+' : ''}
                {formatAmount(net)}
              </Text>
            </View>
            {lines.map(t => (
              <Row key={t.id} transaction={t} onSelect={onSelect} />
            ))}
          </View>
        );
      })}
    </>
  );
}
