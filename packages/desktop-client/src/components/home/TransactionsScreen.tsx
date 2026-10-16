import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { currentDay } from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import type { TransactionEntity } from '@actual-app/core/types/models';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

import { useAccountBalances } from '#hooks/useAccountBalances';
import { useAccounts } from '#hooks/useAccounts';
import { useCategoriesById } from '#hooks/useCategories';
import { usePayeesById } from '#hooks/usePayees';
import { useQuery } from '#hooks/useQuery';

import { accent, radius } from './design';
import { Card, fieldStyle, IconButton, ScreenHeader } from './layout';
import { periodFor } from './periods';
import type { PeriodUnit } from './periods';
import { useLayoutMode } from './responsive';
import { formatAmount } from './spending';
import { TransactionList } from './TransactionList';
import { TransactionSheet } from './TransactionSheet';

const units: Array<[PeriodUnit, string]> = [
  ['days', 'Jours'],
  ['weeks', 'Semaines'],
  ['months', 'Mois'],
  ['years', 'Années'],
];

type Kind = 'all' | 'out' | 'in' | 'transfers';
const kinds: Array<[Kind, string]> = [
  ['all', 'Tout'],
  ['out', 'Dépenses'],
  ['in', 'Rentrées'],
  ['transfers', 'Virements'],
];

// Long periods are cut at this many lines until asked for more.
const PAGE = 200;

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flexShrink: 0,
        height: 34,
        padding: '0 14px',
        borderRadius: radius.pill,
        border: `1px solid ${selected ? accent : 'rgba(255, 255, 255, 0.08)'}`,
        backgroundColor: selected ? `${accent}26` : 'transparent',
        color: selected ? accent : theme.pageText,
        fontSize: 14,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

export function TransactionsScreen() {
  const mode = useLayoutMode();
  const today = currentDay();
  const [params, setParams] = useSearchParams();
  const unit = (units.find(([u]) => u === params.get('unit'))?.[0] ??
    'days') as PeriodUnit;
  const offset = Math.max(0, Number(params.get('offset')) || 0);
  const accountId = params.get('account');
  const kind = (kinds.find(([k]) => k === params.get('kind'))?.[0] ??
    'all') as Kind;
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<TransactionEntity | null>(null);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value == null) next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
    setLimit(PAGE);
  };

  const period = periodFor(unit, offset, today);
  const { data: accounts } = useAccounts();
  const { data: payees } = usePayeesById();
  const { data: categories } = useCategoriesById();
  const open = (accounts ?? []).filter(a => !a.closed);
  const account = open.find(a => a.id === accountId);
  const balances = useAccountBalances(accountId ? [accountId] : []);
  const balance = accountId ? balances[accountId] : undefined;

  const { data } = useQuery<TransactionEntity>(
    () =>
      q('transactions')
        .filter({
          // One operator per field: the two bounds go in separate conditions.
          $and: [
            { date: { $gte: period.start } },
            { date: { $lte: period.end } },
          ],
          starting_balance_flag: false,
          ...(accountId ? { account: accountId } : {}),
        })
        .orderBy([{ date: 'desc' }, { sort_order: 'desc' }])
        .select('*')
        .options({ splits: 'inline' }),
    [period.start, period.end, accountId],
  );

  const lines = useMemo(() => {
    const needle = search
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
    return (data ?? []).filter(t => {
      // Across all accounts a transfer would show twice; keep the side money leaves from.
      if (!accountId && t.transfer_id && t.amount > 0) return false;
      // Transfers only move money between accounts; they get their own filter.
      if ((kind === 'transfers') !== Boolean(t.transfer_id)) return false;
      if (kind === 'out' && t.amount >= 0) return false;
      if (kind === 'in' && t.amount <= 0) return false;
      if (!needle) return true;
      const text = [
        t.payee ? payees?.[t.payee]?.name : '',
        t.imported_payee,
        t.notes,
        t.category ? categories?.list[t.category]?.name : '',
      ]
        .join(' ')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');
      return text.includes(needle);
    });
  }, [data, accountId, kind, search, payees, categories]);

  const spent = lines
    .filter(t => t.amount < 0 && !t.transfer_id)
    .reduce((sum, t) => sum - t.amount, 0);
  const received = lines
    .filter(t => t.amount > 0 && !t.transfer_id)
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <View style={{ gap: mode === 'phone' ? 14 : 22 }}>
      <ScreenHeader
        back={
          account
            ? { to: '/home/accounts', label: 'Comptes' }
            : { to: '/home', label: "Aujourd'hui" }
        }
        title={account ? account.name : 'Opérations'}
        overline={
          account
            ? balance != null
              ? `Solde ${formatAmount(balance)}`
              : undefined
            : 'Tous les comptes'
        }
      />

      <View
        role="tablist"
        style={{
          flexDirection: 'row',
          padding: 4,
          borderRadius: 14,
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          maxWidth: 520,
        }}
      >
        {units.map(([value, label]) => {
          const selected = value === unit;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => update({ unit: value, offset: null })}
              style={{
                flex: 1,
                height: 36,
                border: 'none',
                borderRadius: 11,
                backgroundColor: selected
                  ? 'rgba(255, 255, 255, 0.12)'
                  : 'transparent',
                color: selected ? theme.pageText : theme.pageTextSubdued,
                fontSize: 14,
                fontWeight: selected ? 600 : 500,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          );
        })}
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          maxWidth: 520,
        }}
      >
        <IconButton
          label="Période précédente"
          onClick={() => update({ offset: String(offset + 1) })}
        >
          <ChevronLeft size={20} />
        </IconButton>
        <Text style={{ fontSize: 17, fontWeight: 600, textAlign: 'center' }}>
          {period.label}
        </Text>
        <IconButton
          label="Période suivante"
          disabled={offset === 0}
          onClick={() =>
            update({ offset: offset > 1 ? String(offset - 1) : null })
          }
        >
          <ChevronRight size={20} />
        </IconButton>
      </View>

      <View style={{ gap: 10 }}>
        <View style={{ position: 'relative', maxWidth: 520 }}>
          <Search
            size={16}
            color={theme.pageTextSubdued}
            style={{ position: 'absolute', left: 14, top: 16 }}
          />
          <input
            placeholder="Marchand, note, catégorie…"
            aria-label="Chercher"
            value={search}
            onChange={event => {
              setSearch(event.target.value);
              setLimit(PAGE);
            }}
            style={{
              ...fieldStyle,
              padding: '12px 16px 12px 38px',
              fontSize: 15,
            }}
          />
        </View>
        <View
          style={{
            flexDirection: 'row',
            gap: 6,
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          {kinds.map(([value, label]) => (
            <Chip
              key={value}
              selected={kind === value}
              onClick={() => update({ kind: value === 'all' ? null : value })}
            >
              {label}
            </Chip>
          ))}
          <View
            style={{
              width: 1,
              flexShrink: 0,
              margin: '6px 4px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            }}
          />
          <Chip selected={!accountId} onClick={() => update({ account: null })}>
            Tous les comptes
          </Chip>
          {open.map(a => (
            <Chip
              key={a.id}
              selected={a.id === accountId}
              onClick={() => update({ account: a.id })}
            >
              {a.name}
            </Chip>
          ))}
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, maxWidth: 520 }}>
        {[
          ['Dépensé', formatAmount(spent), theme.pageText],
          ['Reçu', `+ ${formatAmount(received)}`, theme.numberPositive],
        ].map(([label, value, color]) => (
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
            <Text style={{ fontSize: 18, fontWeight: 600, color }}>
              {value}
            </Text>
          </View>
        ))}
      </View>

      <Card style={{ padding: '0 6px 6px' }}>
        <TransactionList
          transactions={lines.slice(0, limit)}
          groupByDay
          empty="Aucune opération sur cette période."
          onSelect={setEditing}
        />
        {lines.length > limit && (
          <button
            type="button"
            onClick={() => setLimit(limit + PAGE)}
            style={{
              margin: 8,
              height: 42,
              border: 'none',
              borderRadius: 14,
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: theme.pageText,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Afficher plus ({lines.length - limit} restantes)
          </button>
        )}
      </Card>

      {editing && (
        <TransactionSheet
          transaction={editing}
          centered={mode !== 'phone'}
          onClose={() => setEditing(null)}
        />
      )}
    </View>
  );
}
