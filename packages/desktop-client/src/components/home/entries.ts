import { send } from '@actual-app/core/platform/client/connection';
import type {
  AccountEntity,
  PayeeEntity,
  TransactionEntity,
} from '@actual-app/core/types/models';

import { useAccounts } from '#hooks/useAccounts';
import { useSyncedPref } from '#hooks/useSyncedPref';

const DEFAULT_RECONCILE_DAYS = 3;

// Accounts a purchase can be noted on: the ones linked to a bank, since only those get a bank
// line to merge with. Without any link, every open account of the budget.
export function useEntryAccounts(): AccountEntity[] {
  const { data } = useAccounts();
  const open = (data ?? []).filter(a => !a.offbudget && !a.closed);
  const linked = open.filter(a => a.account_sync_source);
  return linked.length > 0 ? linked : open;
}

export function useLastAccount() {
  return useSyncedPref('home-last-account');
}

export function useReconcileDays() {
  const [value, setValue] = useSyncedPref('home-reconcile-days');
  const parsed = Number(value);
  const days =
    value != null && Number.isInteger(parsed) && parsed > 0
      ? parsed
      : DEFAULT_RECONCILE_DAYS;
  return [days, (next: number) => setValue(String(next))] as const;
}

// An entry typed by hand that no bank line has confirmed yet.
export function isPending(
  t: Pick<TransactionEntity, 'imported_id' | 'cleared'>,
) {
  return !t.imported_id && !t.cleared;
}

export async function payeeIdFor(
  name: string,
  payees: readonly PayeeEntity[],
): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const existing = payees.find(
    p => !p.transfer_acct && p.name.toLowerCase() === trimmed.toLowerCase(),
  );
  return existing?.id ?? (await send('payee-create', { name: trimmed }));
}

function joinNotes(first?: string | null, second?: string | null) {
  if (!first || !second) return first || second || null;
  if (first.includes(second)) return first;
  const separator = second === MATCHED_TAG ? ' ' : ' | ';
  return `${first}${separator}${second}`;
}

// Bank labels such as "CB MONOPRIX FACT 280926" are unique to one line, so renaming a line
// leaves its old payee behind. Drop it, unless a rule still names it.
async function dropUnusedPayees(ids: Array<string | null | undefined>) {
  const candidates = new Set(ids.filter((id): id is string => Boolean(id)));
  if (candidates.size === 0) return;
  const orphaned = new Set(
    (await send('payees-get-orphaned')).map(row => row.id),
  );
  const rules = await send('rules-get');
  const named = new Set(
    rules.flatMap(rule =>
      [...rule.conditions, ...rule.actions].map(item =>
        'value' in item ? String(item.value) : '',
      ),
    ),
  );
  const deleted = [...candidates].filter(
    id => orphaned.has(id) && !named.has(id),
  );
  if (deleted.length > 0) {
    await send('payees-batch-change', { deleted: deleted.map(id => ({ id })) });
  }
}

// Saves without Actual's "merge the unused payee?" prompt, which would fire on every bank
// label replaced from these screens, and removes the label instead.
export async function saveTransactions({
  added = [],
  updated = [],
  deleted = [],
  previousPayees = [],
}: {
  added?: TransactionEntity[];
  updated?: TransactionEntity[];
  deleted?: Array<Pick<TransactionEntity, 'id'>>;
  previousPayees?: Array<string | null | undefined>;
}) {
  await send('transactions-batch-update', {
    added,
    updated,
    deleted,
    detectOrphanPayees: false,
  });
  await dropUnusedPayees(previousPayees);
}

// Tag left in the note of a bank line that absorbed a manual entry, so it is not offered again.
export const MATCHED_TAG = '#rapproché';

// Folds a manual entry into the bank lines it became. The bank keeps the amount and the date;
// the name, category and note typed by hand win over what the bank or a rule put there.
export async function mergeIntoBank(
  manual: TransactionEntity,
  bank: TransactionEntity[],
) {
  await saveTransactions({
    updated: bank.map(line => ({
      ...line,
      payee: manual.payee ?? line.payee,
      category: line.is_parent
        ? line.category
        : (manual.category ?? line.category),
      notes: joinNotes(joinNotes(manual.notes, line.notes), MATCHED_TAG),
    })),
    deleted: [{ id: manual.id }],
    previousPayees: bank.map(line => line.payee),
  });
}

// What a transfer paid for, from the "Pour : …" part of its notes.
export function transferPurpose(notes: string | null | undefined) {
  return notes?.match(/(?:^|\|)\s*Pour : ([^|]+)/)?.[1].trim() ?? null;
}
