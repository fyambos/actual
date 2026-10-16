import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import type { TransactionEntity } from '@actual-app/core/types/models';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CloudAlert,
  Inbox,
  Plus,
} from 'lucide-react';

import { useAccounts } from '#hooks/useAccounts';
import { useQuery } from '#hooks/useQuery';

import { BudgetRing } from './BudgetRing';
import { accent, radius } from './design';
import { useInboxCounts } from './InboxScreen';
import { Card, IconButton, ScreenHeader, SectionTitle } from './layout';
import { columns, useLayoutMode } from './responsive';
import {
  formatAmount,
  useDailyBudget,
  useMonthlyBudget,
  useSpending,
} from './spending';
import { useIsSubscription } from './subscriptions';
import { TransactionList } from './TransactionList';
import { TransactionSheet } from './TransactionSheet';

function Stat({
  label,
  value,
  progress,
}: {
  label: string;
  value: string;
  progress?: number;
}) {
  return (
    <View
      style={{
        flex: 1,
        gap: 6,
        padding: 14,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
      }}
    >
      <Text style={{ fontSize: 13, color: theme.pageTextSubdued }}>
        {label}
      </Text>
      <Text style={{ fontSize: 17, fontWeight: 600 }}>{value}</Text>
      {progress != null && (
        <View
          style={{
            height: 4,
            borderRadius: radius.pill,
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${Math.min(progress, 1) * 100}%`,
              height: '100%',
              borderRadius: radius.pill,
              backgroundColor: progress > 1 ? theme.numberNegative : accent,
            }}
          />
        </View>
      )}
    </View>
  );
}

function Banner({
  to,
  icon: Icon,
  children,
}: {
  to: string;
  icon: typeof Inbox;
  children: string;
}) {
  return (
    <Link
      to={to}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        borderRadius: 18,
        backgroundColor: `${accent}1f`,
        border: `1px solid ${accent}44`,
        color: theme.pageText,
        textDecoration: 'none',
        fontSize: 15,
      }}
    >
      <Icon size={20} color={accent} />
      <span style={{ flex: 1 }}>{children}</span>
      <ChevronRight size={18} color={theme.pageTextSubdued} />
    </Link>
  );
}

const STALE_SYNC_DAYS = 3;

// Bank links stop silently when the consent expires; say so once the last sync is old.
function useStaleSync() {
  const { data: accounts } = useAccounts();
  const linked = (accounts ?? []).filter(
    a => a.account_sync_source && !a.closed,
  );
  if (linked.length === 0) return null;
  const oldest = Math.min(
    ...linked.map(a => (a.last_sync ? Number(a.last_sync) : 0)),
  );
  const days = Math.floor((Date.now() - oldest) / 86_400_000);
  return days >= STALE_SYNC_DAYS ? days : null;
}

function dayTitle(day: string, today: string) {
  if (day === today) return "Aujourd'hui";
  if (day === monthUtils.subDays(today, 1)) return 'Hier';
  const text = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
  }).format(new Date(`${day}T12:00:00`));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function TodayScreen() {
  const today = monthUtils.currentDay();
  const [params, setParams] = useSearchParams();
  const requested = params.get('day');
  const day =
    requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && requested <= today
      ? requested
      : today;
  const setDay = (next: string) =>
    setParams(next === today ? {} : { day: next }, { replace: true });

  const month = day.slice(0, 7);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TransactionEntity | null>(null);
  const mode = useLayoutMode();
  const [dailyBudget] = useDailyBudget();
  const [monthlyBudget] = useMonthlyBudget();
  const inbox = useInboxCounts();
  const staleDays = useStaleSync();

  const daySpending = useSpending({ date: day });
  // Subscriptions are planned costs: they stay out of the daily budget and are listed apart.
  const isSubscription = useIsSubscription();
  const daySubscriptions = daySpending.transactions.filter(isSubscription);
  const dayCharges = daySpending.transactions.filter(t => !isSubscription(t));
  const spent = dayCharges.reduce((sum, t) => sum - t.amount, 0);
  const monthSpending = useSpending({
    date: { $transform: '$month', $eq: month },
  });
  const { data: entries } = useQuery<TransactionEntity>(
    () =>
      q('transactions')
        .filter({
          date: day,
          amount: { $gt: 0 },
          'account.offbudget': false,
          transfer_id: null,
          starting_balance_flag: false,
        })
        .select('*')
        .options({ splits: 'inline' }),
    [day],
  );
  const incomes = entries ?? [];
  const { data: latest } = useQuery<TransactionEntity>(
    () =>
      q('transactions')
        .filter({ starting_balance_flag: false })
        .orderBy([{ date: 'desc' }, { sort_order: 'desc' }])
        .select('*')
        .options({ splits: 'inline' })
        .limit(16),
    [],
  );
  // Both sides of a transfer would show; keep the one money leaves from.
  const recent = (latest ?? [])
    .filter(t => !(t.transfer_id && t.amount > 0))
    .slice(0, 8);
  const received = incomes.reduce((sum, t) => sum + t.amount, 0);

  const overline = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: day.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric',
  })
    .format(new Date(`${day}T12:00:00`))
    .replace(/^./, c => c.toUpperCase());

  return (
    <View style={{ gap: mode === 'phone' ? 16 : 28 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 12,
        }}
      >
        <ScreenHeader overline={overline} title={dayTitle(day, today)} />
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <IconButton
            label="Jour précédent"
            onClick={() => setDay(monthUtils.subDays(day, 1))}
          >
            <ChevronLeft size={20} />
          </IconButton>
          <View style={{ position: 'relative' }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.pill,
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CalendarDays size={18} />
            </View>
            <input
              type="date"
              aria-label="Choisir un jour"
              value={day}
              max={today}
              onChange={event =>
                event.target.value && setDay(event.target.value)
              }
              style={{
                position: 'absolute',
                inset: 0,
                opacity: 0,
                cursor: 'pointer',
                colorScheme: 'dark',
              }}
            />
          </View>
          <IconButton
            label="Jour suivant"
            disabled={day === today}
            onClick={() => setDay(monthUtils.addDays(day, 1))}
          >
            <ChevronRight size={20} />
          </IconButton>
          {mode !== 'phone' && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                height: 46,
                marginLeft: 8,
                padding: '0 20px',
                border: 'none',
                borderRadius: 16,
                backgroundColor: accent,
                color: '#fff',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: `0 8px 24px -8px ${accent}`,
              }}
            >
              <Plus size={20} strokeWidth={2.4} />
              Ajouter
            </button>
          )}
        </View>
      </View>

      {(inbox.total > 0 || staleDays != null) && (
        <View style={columns(mode, '1fr 1fr')}>
          {inbox.total > 0 && (
            <Banner to="/home/inbox" icon={Inbox}>
              {`${inbox.total} opération${inbox.total > 1 ? 's' : ''} à traiter`}
            </Banner>
          )}
          {staleDays != null && (
            <Banner to="/home/accounts" icon={CloudAlert}>
              {`Pas de nouvelles de la banque depuis ${staleDays} jours`}
            </Banner>
          )}
        </View>
      )}

      <View style={columns(mode, mode === 'desktop' ? '440px 1fr' : '1fr 1fr')}>
        <Card style={{ alignItems: 'center', gap: 18, paddingTop: 24 }}>
          <BudgetRing spent={spent} budget={dailyBudget} />
          <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch' }}>
            <Stat label="Dépensé" value={formatAmount(spent)} />
            <Stat
              label={month === today.slice(0, 7) ? 'Ce mois-ci' : 'Ce mois-là'}
              value={`${formatAmount(monthSpending.total)} / ${formatAmount(
                monthlyBudget,
              )}`}
              progress={monthSpending.total / monthlyBudget}
            />
          </View>
          {received > 0 && (
            <Text style={{ fontSize: 14, color: theme.numberPositive }}>
              + {formatAmount(received)} reçus ce jour
            </Text>
          )}
        </Card>

        <View style={{ gap: 10 }}>
          <SectionTitle>Dépenses du jour</SectionTitle>
          <Card style={{ padding: 6 }}>
            <TransactionList
              transactions={dayCharges}
              empty={
                day === today
                  ? "Rien pour l'instant. Touche + pour noter une dépense."
                  : 'Aucune dépense ce jour-là.'
              }
              onSelect={setEditing}
            />
          </Card>
          {daySubscriptions.length > 0 && (
            <>
              <SectionTitle>Abonnements · hors budget du jour</SectionTitle>
              <Card style={{ padding: 6 }}>
                <TransactionList
                  transactions={daySubscriptions}
                  empty=""
                  onSelect={setEditing}
                />
              </Card>
            </>
          )}
          {incomes.length > 0 && (
            <>
              <SectionTitle>Rentrées</SectionTitle>
              <Card style={{ padding: 6 }}>
                <TransactionList
                  transactions={incomes}
                  empty=""
                  onSelect={setEditing}
                />
              </Card>
            </>
          )}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <SectionTitle>Activité récente</SectionTitle>
          <Link
            to="/home/transactions"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              padding: '8px 4px 0',
              color: accent,
              textDecoration: 'none',
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            Tout voir
            <ChevronRight size={18} />
          </Link>
        </View>
        <Card style={{ padding: 6 }}>
          <TransactionList
            transactions={recent}
            showDate
            empty="Aucune opération pour l'instant."
            onSelect={setEditing}
          />
        </Card>
      </View>

      {mode === 'phone' && (
        <button
          type="button"
          aria-label="Ajouter"
          onClick={() => setAdding(true)}
          style={{
            position: 'fixed',
            right: 20,
            bottom: 104,
            width: 60,
            height: 60,
            borderRadius: radius.pill,
            border: 'none',
            backgroundColor: accent,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 10px 30px -6px ${accent}`,
            cursor: 'pointer',
            zIndex: 10,
          }}
        >
          <Plus size={28} strokeWidth={2.4} />
        </button>
      )}

      {(adding || editing) && (
        <TransactionSheet
          transaction={editing ?? undefined}
          defaultDate={day}
          centered={mode !== 'phone'}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
        />
      )}
    </View>
  );
}
