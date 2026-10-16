import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { currentDay } from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import type { TransactionEntity } from '@actual-app/core/types/models';
import { Search, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

import { useCategories } from '#hooks/useCategories';
import { usePayees } from '#hooks/usePayees';
import { aqlQuery } from '#queries/aqlQuery';

import { accent, categoryLook, radius } from './design';
import {
  payeeIdFor,
  saveTransactions,
  useEntryAccounts,
  useLastAccount,
} from './entries';
import { fieldStyle, Sheet } from './layout';

function parseEuros(text: string) {
  const value = Number(text.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
}

function centsToText(cents: number) {
  const euros = Math.abs(cents) / 100;
  return Number.isInteger(euros)
    ? String(euros)
    : euros.toFixed(2).replace('.', ',');
}

function Label({ children }: { children: string }) {
  return (
    <Text
      style={{ fontSize: 13, color: theme.pageTextSubdued, padding: '0 4px' }}
    >
      {children}
    </Text>
  );
}

function Pill({
  selected,
  color = accent,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  color?: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '9px 14px',
        borderRadius: radius.pill,
        border: `1px solid ${selected ? color : 'rgba(255, 255, 255, 0.08)'}`,
        backgroundColor: selected ? `${color}26` : 'transparent',
        color: selected ? color : theme.pageText,
        fontSize: 14,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled && !selected ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

// Adds a purchase noted by hand, or edits any transaction. Amount, date and account of a line
// that came from the bank stay as the bank reported them.
export function TransactionSheet({
  transaction,
  defaultDate,
  centered,
  onClose,
}: {
  transaction?: TransactionEntity;
  defaultDate?: string;
  centered: boolean;
  onClose: () => void;
}) {
  const editing = transaction != null;
  const fromBank = Boolean(transaction?.imported_id);
  const isChild = Boolean(transaction?.is_child);

  const accounts = useEntryAccounts();
  const [lastAccount, setLastAccount] = useLastAccount();
  const { data: categories } = useCategories();
  const { data: payees } = usePayees();

  const [income, setIncome] = useState((transaction?.amount ?? -1) > 0);
  const [amountText, setAmountText] = useState(
    transaction ? centsToText(transaction.amount) : '',
  );
  const [label, setLabel] = useState(() => {
    const payee = (payees ?? []).find(p => p.id === transaction?.payee);
    return payee && !payee.transfer_acct ? payee.name : '';
  });
  const [categoryId, setCategoryId] = useState<string | null>(
    transaction?.category ?? null,
  );
  const [date, setDate] = useState(
    transaction?.date ?? defaultDate ?? currentDay(),
  );
  const [accountId, setAccountId] = useState<string | null>(
    transaction?.account ??
      (accounts.some(a => a.id === lastAccount) ? lastAccount! : null) ??
      accounts[0]?.id ??
      null,
  );
  const [notes, setNotes] = useState(transaction?.notes ?? '');

  // Payees may load after the sheet opens.
  const payeeName = (payees ?? []).find(
    p => p.id === transaction?.payee && !p.transfer_acct,
  )?.name;
  useEffect(() => {
    if (payeeName) setLabel(current => current || payeeName);
  }, [payeeName]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  // A new entry starts on the amount, the one field always filled in.
  useEffect(() => {
    if (!editing) amountRef.current?.focus();
  }, [editing]);

  const groups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (categories?.grouped ?? [])
      .filter(g => !g.hidden && Boolean(g.is_income) === income)
      .map(g => ({
        ...g,
        categories: (g.categories ?? []).filter(
          c =>
            !c.hidden &&
            (!needle ||
              c.name.toLowerCase().includes(needle) ||
              g.name.toLowerCase().includes(needle)),
        ),
      }))
      .filter(g => g.categories.length > 0);
  }, [categories, income, search]);

  const payeeNames = useMemo(
    () => (payees ?? []).filter(p => !p.transfer_acct).map(p => p.name),
    [payees],
  );

  // Picks the category this merchant had last time, if none is chosen yet.
  async function suggestCategory() {
    if (categoryId || !label.trim()) return;
    const payee = (payees ?? []).find(
      p =>
        !p.transfer_acct && p.name.toLowerCase() === label.trim().toLowerCase(),
    );
    if (!payee) return;
    const { data } = await aqlQuery(
      q('transactions')
        .filter({ payee: payee.id, category: { $ne: null } })
        .orderBy({ date: 'desc' })
        .select(['category'])
        .limit(1),
    );
    const found = (data as Array<{ category: string }>)[0]?.category;
    if (found) setCategoryId(current => current ?? found);
  }

  async function save() {
    const cents =
      fromBank || isChild ? transaction!.amount : parseEuros(amountText);
    if (cents == null) {
      setError('Entre un montant');
      return;
    }
    if (!accountId) {
      setError('Choisis un compte');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const payee = isChild
        ? transaction!.payee
        : await payeeIdFor(label, payees ?? []);
      const amount = fromBank || isChild ? cents : income ? cents : -cents;
      if (editing) {
        await saveTransactions({
          updated: [
            {
              ...transaction,
              amount,
              payee: payee ?? transaction.payee,
              category: categoryId,
              notes: notes.trim() || null,
              date: fromBank || isChild ? transaction.date : date,
              account: fromBank || isChild ? transaction.account : accountId,
            },
          ],
          previousPayees: [transaction.payee],
        });
      } else {
        await saveTransactions({
          added: [
            {
              id: uuidv4(),
              account: accountId,
              date,
              amount,
              payee,
              category: categoryId,
              notes: notes.trim() || null,
              cleared: false,
            },
          ],
        });
        setLastAccount(accountId);
      }
      onClose();
    } catch {
      setError("L'opération n'a pas pu être enregistrée");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!transaction) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    try {
      await saveTransactions({
        deleted: [{ id: transaction.id }],
        previousPayees: [transaction.payee],
      });
      onClose();
    } catch {
      setError("L'opération n'a pas pu être supprimée");
      setSaving(false);
    }
  }

  const lockedAmount = fromBank || isChild;
  const title = editing
    ? 'Modifier'
    : income
      ? 'Nouvelle rentrée'
      : 'Nouvelle dépense';

  return (
    <Sheet title={title} centered={centered} onClose={onClose}>
      {!lockedAmount && (
        <View style={{ flexDirection: 'row', gap: 8, alignSelf: 'center' }}>
          <Pill
            selected={!income}
            onClick={() => {
              setIncome(false);
              setCategoryId(null);
            }}
          >
            Dépense
          </Pill>
          <Pill
            selected={income}
            onClick={() => {
              setIncome(true);
              setCategoryId(null);
            }}
          >
            Rentrée
          </Pill>
        </View>
      )}

      <View style={{ alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          {income && (
            <Text
              style={{
                fontSize: 40,
                fontWeight: 600,
                color: theme.numberPositive,
              }}
            >
              +
            </Text>
          )}
          <input
            ref={amountRef}
            inputMode="decimal"
            placeholder="0"
            aria-label="Montant"
            disabled={lockedAmount}
            value={amountText}
            onChange={event => {
              setAmountText(event.target.value);
              setError(null);
            }}
            style={{
              width: `${Math.max(amountText.length, 1) * 0.62}em`,
              border: 'none',
              background: 'transparent',
              color: theme.pageText,
              fontSize: 56,
              fontWeight: 700,
              letterSpacing: -2,
              textAlign: 'center',
              outline: 'none',
              padding: 0,
            }}
          />
          <Text
            style={{
              fontSize: 36,
              fontWeight: 600,
              color: theme.pageTextSubdued,
            }}
          >
            €
          </Text>
        </View>
        {fromBank && (
          <Text
            style={{
              fontSize: 13,
              color: theme.pageTextSubdued,
              textAlign: 'center',
            }}
          >
            Montant, date et compte viennent de la banque.
          </Text>
        )}
        {error && (
          <Text style={{ color: theme.numberNegative, fontSize: 14 }}>
            {error}
          </Text>
        )}
      </View>

      {!isChild && (
        <>
          <input
            placeholder={income ? 'De qui ?' : 'Où ? (boulangerie, Uber…)'}
            aria-label="Où"
            list="home-payees"
            value={label}
            onChange={event => setLabel(event.target.value)}
            onBlur={() => void suggestCategory()}
            style={fieldStyle}
          />
          <datalist id="home-payees">
            {payeeNames.map(name => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </>
      )}

      <View style={{ gap: 10, flexShrink: 0 }}>
        <View style={{ position: 'relative' }}>
          <Search
            size={16}
            color={theme.pageTextSubdued}
            style={{ position: 'absolute', left: 14, top: 16 }}
          />
          <input
            placeholder="Chercher une catégorie"
            aria-label="Chercher une catégorie"
            value={search}
            onChange={event => setSearch(event.target.value)}
            style={{
              ...fieldStyle,
              paddingLeft: 38,
              padding: '12px 16px 12px 38px',
              fontSize: 15,
            }}
          />
        </View>
        <View style={{ maxHeight: 230, overflowY: 'auto', gap: 12 }}>
          {groups.map(group => (
            <View key={group.id} style={{ gap: 6 }}>
              <Label>{group.name}</Label>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {group.categories.map(category => {
                  const selected = category.id === categoryId;
                  const { icon: Icon, color } = categoryLook(category.name);
                  return (
                    <Pill
                      key={category.id}
                      selected={selected}
                      color={color}
                      onClick={() =>
                        setCategoryId(selected ? null : category.id)
                      }
                    >
                      <Icon size={15} />
                      {category.name}
                    </Pill>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </View>

      {!lockedAmount && (
        <View style={{ gap: 8, flexShrink: 0 }}>
          <Label>Payé avec</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {accounts.map(account => (
              <Pill
                key={account.id}
                selected={account.id === accountId}
                onClick={() => setAccountId(account.id)}
              >
                {account.name}
              </Pill>
            ))}
          </View>
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 10, flexShrink: 0 }}>
        {!lockedAmount && (
          <input
            type="date"
            aria-label="Date"
            value={date}
            max={currentDay()}
            onChange={event =>
              event.target.value && setDate(event.target.value)
            }
            style={{ ...fieldStyle, flex: 1, colorScheme: 'dark' }}
          />
        )}
        <input
          placeholder="Note"
          aria-label="Note"
          value={notes}
          onChange={event => setNotes(event.target.value)}
          style={{ ...fieldStyle, flex: 2 }}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: 10, flexShrink: 0 }}>
        {editing && !fromBank && !isChild && (
          <button
            type="button"
            disabled={saving}
            onClick={() => void remove()}
            style={{
              height: 54,
              padding: '0 18px',
              border: 'none',
              borderRadius: 18,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: confirmDelete
                ? theme.numberNegative
                : 'rgba(255, 255, 255, 0.06)',
              color: confirmDelete ? '#fff' : theme.numberNegative,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Trash2 size={18} />
            {confirmDelete ? 'Confirmer' : 'Supprimer'}
          </button>
        )}
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          style={{
            flex: 1,
            height: 54,
            border: 'none',
            borderRadius: 18,
            backgroundColor: accent,
            color: '#fff',
            fontSize: 17,
            fontWeight: 600,
            cursor: 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          Enregistrer
        </button>
      </View>
    </Sheet>
  );
}
