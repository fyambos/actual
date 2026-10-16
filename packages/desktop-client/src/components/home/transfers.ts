import { useMemo } from 'react';

import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import type { TransactionEntity } from '@actual-app/core/types/models';

import { useAccounts } from '#hooks/useAccounts';
import { usePayeesById } from '#hooks/usePayees';
import { useQuery } from '#hooks/useQuery';

import { useReconcileDays } from './entries';
import { isOverdue } from './reconcile';
import { merchantName } from './recurring';

// What a transfer between two accounts paid for.
//
// A PayPal purchase shows twice: the purchase on the PayPal account, and a few days later the
// bank debit that tops PayPal up, booked as a transfer. The transfer is explained when the
// purchase it paid for is found, so it can be hidden; one left unexplained needs a look.

const DAY = 86_400_000;
const PURCHASE_WINDOW = 7;
const FORWARD_WINDOW = 3;

export type TransferLine = {
  id: string;
  date: string;
  amount: number;
  account: string;
  transferId: string | null;
  // Account on the other side of a transfer.
  toAccount: string | null;
  name: string;
  notes: string | null;
};

export type TransferAccount = { id: string; name: string; offbudget: boolean };

const dayFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
});

function days(from: string, to: string) {
  return (Date.parse(to) - Date.parse(from)) / DAY;
}

// What a transfer paid for, from the "Pour : …" part of its notes.
export function transferPurpose(notes: string | null | undefined) {
  return notes?.match(/(?:^|\|)\s*Pour : ([^|]+)/)?.[1].trim() ?? null;
}

const isCredit = (account: TransferAccount | undefined) =>
  Boolean(account && /cr[ée]dit/i.test(account.name));

// Purpose of every transfer line in `lines`, keyed by id; null when nothing explains it. Both
// sides of a transfer get the purpose found for the side money leaves from.
export function explainTransfers(
  lines: TransferLine[],
  accounts: TransferAccount[],
) {
  const accountById = new Map(accounts.map(a => [a.id, a]));
  const purchases = lines.filter(l => !l.transferId && l.amount < 0);
  const refunds = lines.filter(l => !l.transferId && l.amount > 0);
  const outgoing = lines
    .filter(l => l.transferId && l.toAccount && l.amount < 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const used = new Set<string>();
  const purposes = new Map<string, string | null>();
  // Accounts topped up to pay for purchases (a PayPal account).
  const wallets = new Set<string>();

  for (const t of outgoing) {
    const to = accountById.get(t.toAccount!);
    let purpose = transferPurpose(t.notes);
    let purchaseFound = false;

    const from = accountById.get(t.account);
    if (!purpose && to?.offbudget) purpose = to.name;
    if (!purpose && from?.offbudget) purpose = `Depuis ${from.name}`;
    if (!purpose && isCredit(to)) purpose = `Remboursement ${to!.name}`;

    if (!purpose) {
      const purchase = purchases
        .filter(
          p =>
            !used.has(p.id) &&
            p.account === t.toAccount &&
            p.amount === t.amount &&
            days(p.date, t.date) >= 0 &&
            days(p.date, t.date) <= PURCHASE_WINDOW,
        )
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      if (purchase) {
        used.add(purchase.id);
        purchaseFound = true;
        purpose = `${purchase.name} du ${dayFormat.format(
          new Date(`${purchase.date}T12:00:00`),
        )}`;
      }
    }

    if (!purpose) {
      // A refund received on this account and sent back to the bank.
      const refund = refunds
        .filter(
          r =>
            !used.has(r.id) &&
            r.account === t.account &&
            r.amount === -t.amount &&
            days(r.date, t.date) >= 0 &&
            days(r.date, t.date) <= PURCHASE_WINDOW,
        )
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      if (refund) {
        used.add(refund.id);
        purpose = `Remboursement ${refund.name} du ${dayFormat.format(
          new Date(`${refund.date}T12:00:00`),
        )}`;
      }
    }

    if (!purpose) {
      // Money passed straight on, like a Paiement en 4X instalment paid to the credit account.
      const forward = outgoing.find(
        f =>
          f.account === t.toAccount &&
          f.id !== t.transferId &&
          f.amount === t.amount &&
          Math.abs(days(t.date, f.date)) <= FORWARD_WINDOW,
      );
      const next = forward ? accountById.get(forward.toAccount!) : undefined;
      if (next) {
        purpose = isCredit(next)
          ? `Échéance ${next.name} (Paiement en 4X)`
          : `Transmis vers ${next.name}`;
      }
    }

    if (purpose && purchaseFound) wallets.add(t.toAccount!);
    purposes.set(t.id, purpose);
    if (t.transferId) purposes.set(t.transferId, purpose);
  }

  // Money sent back from an account that is topped up for purchases, like a PayPal balance
  // withdrawn to the bank, needs no further explanation.
  for (const t of outgoing) {
    if (purposes.get(t.id) != null) continue;
    if (!wallets.has(t.account) || wallets.has(t.toAccount!)) continue;
    const purpose = `Solde ${accountById.get(t.account)?.name ?? ''} reversé`;
    purposes.set(t.id, purpose);
    if (t.transferId) purposes.set(t.transferId, purpose);
  }
  return purposes;
}

// Purposes of the transfers dated from `from` to `to`, looking a week around for what they paid.
export function useTransferPurposes(from: string, to: string) {
  const start = monthUtils.subDays(from, PURCHASE_WINDOW);
  const end = monthUtils.addDays(to, FORWARD_WINDOW);
  const { data } = useQuery<TransactionEntity>(
    () =>
      q('transactions')
        .filter({
          starting_balance_flag: false,
          $and: [{ date: { $gte: start } }, { date: { $lte: end } }],
        })
        .select('*')
        .options({ splits: 'none' }),
    [start, end],
  );
  const { data: payees } = usePayeesById();
  const { data: accounts } = useAccounts();

  return useMemo(() => {
    const lines = (data ?? []).map(t => {
      const payee = t.payee ? payees?.[t.payee] : null;
      return {
        id: t.id,
        date: t.date,
        amount: t.amount,
        account: t.account,
        transferId: t.transfer_id ?? null,
        toAccount: t.transfer_id ? (payee?.transfer_acct ?? null) : null,
        name: payee ? merchantName(payee.name) : (t.imported_payee ?? ''),
        notes: t.notes ?? null,
      };
    });
    return explainTransfers(
      lines,
      (accounts ?? []).map(a => ({
        id: a.id,
        name: a.name,
        offbudget: Boolean(a.offbudget),
      })),
    );
  }, [data, payees, accounts]);
}

// How far back the inbox looks for transfers left unexplained.
const INBOX_DAYS = 120;

// Payments out to another account that nothing explains after the reconcile delay, the same
// number of business days a hand-typed entry waits for its bank line.
export function useUnexplainedTransfers() {
  const [delay] = useReconcileDays();
  const today = monthUtils.currentDay();
  const from = monthUtils.subDays(today, INBOX_DAYS);
  const purposes = useTransferPurposes(from, today);
  const { data } = useQuery<TransactionEntity>(
    () =>
      q('transactions')
        .filter({
          transfer_id: { $ne: null },
          amount: { $lt: 0 },
          $and: [{ date: { $gte: from } }, { date: { $lte: today } }],
        })
        .orderBy({ date: 'desc' })
        .select('*')
        .options({ splits: 'none' }),
    [from, today],
  );
  return (data ?? []).filter(
    t => purposes.get(t.id) === null && isOverdue(t.date, today, delay),
  );
}

// Writes what a transfer paid for after its bank reference, replacing an earlier one.
export function withPurpose(notes: string | null | undefined, purpose: string) {
  const base = (notes ?? '').replace(/\s*\|?\s*Pour : [^|]*$/, '').trim();
  return base ? `${base} | Pour : ${purpose}` : `Pour : ${purpose}`;
}
