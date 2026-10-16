import React, { useMemo, useState } from 'react';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { currentDay } from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import type { TransactionEntity } from '@actual-app/core/types/models';
import { Banknote, Check, Pencil } from 'lucide-react';

import { useAccounts } from '#hooks/useAccounts';
import { useCategoriesById } from '#hooks/useCategories';
import { usePayeesById } from '#hooks/usePayees';
import { useQuery } from '#hooks/useQuery';

import { accent, radius } from './design';
import {
  isPending,
  MATCHED_TAG,
  mergeIntoBank,
  saveTransactions,
  useReconcileDays,
} from './entries';
import { Card, CategoryTile, ScreenHeader, SectionTitle } from './layout';
import { findCandidates, isOverdue } from './reconcile';
import type { Candidate, ReconcileTransaction } from './reconcile';
import { merchantName } from './recurring';
import { columns, useLayoutMode } from './responsive';
import { formatAmount } from './spending';
import { TransactionList } from './TransactionList';
import { TransactionSheet } from './TransactionSheet';

const shortDate = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

function formatDay(date: string) {
  return shortDate.format(new Date(`${date}T12:00:00`));
}

const budgetLines = {
  'account.offbudget': false,
  transfer_id: null,
  starting_balance_flag: false,
};

function useUncategorized() {
  return useQuery<TransactionEntity>(
    () =>
      q('transactions')
        .filter({
          ...budgetLines,
          category: null,
          is_parent: false,
          // A manual entry gets its category when it is matched with the bank line.
          $or: [{ imported_id: { $ne: null } }, { cleared: true }],
        })
        .orderBy({ date: 'desc' })
        .select('*')
        .options({ splits: 'inline' }),
    [],
  );
}

function usePendingEntries() {
  return useQuery<TransactionEntity>(
    () =>
      q('transactions')
        .filter({ ...budgetLines, imported_id: null, cleared: false })
        .orderBy({ date: 'asc' })
        .select('*')
        .options({ splits: 'none' }),
    [],
  );
}

// What the inbox badge counts: uncategorised lines and manual entries the bank never confirmed.
export function useInboxCounts() {
  const [days] = useReconcileDays();
  const today = currentDay();
  const uncategorized = useUncategorized().data ?? [];
  const pending = (usePendingEntries().data ?? []).filter(isPending);
  const overdue = pending.filter(t => isOverdue(t.date, today, days));
  return {
    uncategorized: uncategorized.length,
    toReconcile: overdue.length,
    total: uncategorized.length + overdue.length,
  };
}

function CandidateRow({
  candidate,
  accountName,
  label,
  onPick,
  busy,
}: {
  candidate: Candidate;
  accountName: (id: string) => string;
  label: (t: ReconcileTransaction) => string;
  onPick: () => void;
  busy: boolean;
}) {
  const total = candidate.transactions.reduce((s, t) => s + t.amount, 0);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
      }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        {candidate.transactions.map(t => (
          <View key={t.id} style={{ flexDirection: 'row', gap: 8 }}>
            <Text
              style={{
                flex: 1,
                fontSize: 14,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {label(t)}
            </Text>
            <Text style={{ fontSize: 14, fontWeight: 600 }}>
              {formatAmount(t.amount)}
            </Text>
          </View>
        ))}
        <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
          {[
            ...new Set(candidate.transactions.map(t => formatDay(t.date))),
          ].join(', ')}
          {' · '}
          {accountName(candidate.transactions[0].account)}
          {candidate.transactions.length > 1 &&
            ` · ${candidate.transactions.length} lignes = ${formatAmount(total)}`}
          {candidate.exact ? ' · montant exact' : ''}
        </Text>
      </View>
      <button
        type="button"
        disabled={busy}
        onClick={onPick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 38,
          padding: '0 14px',
          border: 'none',
          borderRadius: radius.pill,
          backgroundColor: accent,
          color: '#fff',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          flexShrink: 0,
          opacity: busy ? 0.6 : 1,
        }}
      >
        <Check size={16} />
        C'est ça
      </button>
    </View>
  );
}

export function InboxScreen() {
  const mode = useLayoutMode();
  const today = currentDay();
  const [days] = useReconcileDays();
  const { data: accounts } = useAccounts();
  const { data: payees } = usePayeesById();
  const { data: categories } = useCategoriesById();
  const uncategorized = useUncategorized().data ?? [];
  const pending = (usePendingEntries().data ?? []).filter(isPending);
  const overdue = pending.filter(t => isOverdue(t.date, today, days));
  const waiting = pending.length - overdue.length;
  const [editing, setEditing] = useState<TransactionEntity | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const earliest = overdue[0]?.date ?? today;
  const { data: bankLines } = useQuery<TransactionEntity>(
    () =>
      q('transactions')
        .filter({
          ...budgetLines,
          imported_id: { $ne: null },
          date: { $gte: earliest },
        })
        .select('*')
        .options({ splits: 'none' }),
    [earliest],
  );

  const accountName = (id: string) =>
    (accounts ?? []).find(a => a.id === id)?.name ?? '';
  const nameOf = (t: TransactionEntity) => {
    const payee = t.payee ? payees?.[t.payee] : null;
    return payee ? merchantName(payee.name) : (t.imported_payee ?? 'Sans nom');
  };

  const bankById = useMemo(
    () => new Map((bankLines ?? []).map(t => [t.id, t])),
    [bankLines],
  );
  const pool = useMemo(
    () =>
      (bankLines ?? [])
        .filter(t => !(t.notes ?? '').includes(MATCHED_TAG))
        .map(t => ({
          id: t.id,
          date: t.date,
          amount: t.amount,
          account: t.account,
          label: `${nameOf(t)} ${t.imported_payee ?? ''}`,
        })),
    // nameOf only reads payees, which is listed.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [bankLines, payees],
  );

  async function pick(manual: TransactionEntity, candidate: Candidate) {
    setBusy(manual.id);
    try {
      await mergeIntoBank(
        manual,
        candidate.transactions.map(t => bankById.get(t.id)!),
      );
    } finally {
      setBusy(null);
    }
  }

  async function noBankLine(manual: TransactionEntity) {
    setBusy(manual.id);
    try {
      await saveTransactions({ updated: [{ ...manual, cleared: true }] });
    } finally {
      setBusy(null);
    }
  }

  const shown = showAll ? uncategorized : uncategorized.slice(0, 30);

  return (
    <View style={{ gap: mode === 'phone' ? 16 : 28 }}>
      <ScreenHeader overline="Ce qui attend ton avis" title="À traiter" />

      <View style={columns(mode, mode === 'desktop' ? '1.2fr 1fr' : '1fr')}>
        <View style={{ gap: 10 }}>
          <SectionTitle>À rapprocher ({overdue.length})</SectionTitle>
          <Text
            style={{
              fontSize: 13,
              color: theme.pageTextSubdued,
              padding: '0 4px',
            }}
          >
            Tes saisies que la banque n'a pas confirmées après {days} jours
            ouvrés.
            {waiting > 0 &&
              ` ${waiting} plus récente${waiting > 1 ? 's' : ''} attend${waiting > 1 ? 'ent' : ''} encore la banque.`}
          </Text>
          {overdue.length === 0 && (
            <Card>
              <Text style={{ color: theme.pageTextSubdued, fontSize: 15 }}>
                Rien à rapprocher.
              </Text>
            </Card>
          )}
          {overdue.map(manual => {
            const candidates = findCandidates(
              {
                id: manual.id,
                date: manual.date,
                amount: manual.amount,
                account: manual.account,
                label: nameOf(manual),
              },
              pool,
            );
            const category = manual.category
              ? categories?.list[manual.category]?.name
              : null;
            return (
              <Card key={manual.id} style={{ gap: 12, padding: 14 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <CategoryTile name={category} />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={{ fontSize: 16, fontWeight: 600 }}>
                      {nameOf(manual)}
                    </Text>
                    <Text
                      style={{ fontSize: 13, color: theme.pageTextSubdued }}
                    >
                      {formatDay(manual.date)} · {accountName(manual.account)} ·{' '}
                      {category ?? 'Sans catégorie'}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 17, fontWeight: 700 }}>
                    {formatAmount(manual.amount)}
                  </Text>
                </View>
                {candidates.length > 0 ? (
                  <>
                    <Text
                      style={{ fontSize: 13, color: theme.pageTextSubdued }}
                    >
                      Probablement l'une de ces lignes de la banque :
                    </Text>
                    {candidates.map(candidate => (
                      <CandidateRow
                        key={candidate.transactions.map(t => t.id).join()}
                        candidate={candidate}
                        accountName={accountName}
                        label={t => {
                          const line = bankById.get(t.id);
                          return line ? nameOf(line) : t.label;
                        }}
                        busy={busy === manual.id}
                        onPick={() => void pick(manual, candidate)}
                      />
                    ))}
                  </>
                ) : (
                  <Text style={{ fontSize: 13, color: theme.pageTextSubdued }}>
                    Aucune ligne de la banque ne ressemble à cette saisie.
                  </Text>
                )}
                <View
                  style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}
                >
                  {[
                    {
                      icon: Banknote,
                      text: 'Payé en espèces, pas de ligne',
                      action: () => void noBankLine(manual),
                    },
                    {
                      icon: Pencil,
                      text: 'Modifier',
                      action: () => setEditing(manual),
                    },
                  ].map(({ icon: Icon, text, action }) => (
                    <button
                      key={text}
                      type="button"
                      disabled={busy === manual.id}
                      onClick={action}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        height: 36,
                        padding: '0 12px',
                        border: 'none',
                        borderRadius: radius.pill,
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        color: theme.pageText,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      <Icon size={15} />
                      {text}
                    </button>
                  ))}
                </View>
              </Card>
            );
          })}
        </View>

        <View style={{ gap: 10 }}>
          <SectionTitle>À catégoriser ({uncategorized.length})</SectionTitle>
          <Card style={{ padding: 6 }}>
            <TransactionList
              transactions={shown}
              showDate
              empty="Tout est catégorisé."
              onSelect={setEditing}
            />
            {!showAll && uncategorized.length > shown.length && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
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
                Voir les {uncategorized.length - shown.length} autres
              </button>
            )}
          </Card>
        </View>
      </View>

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
