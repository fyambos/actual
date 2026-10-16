import { describe, expect, it } from 'vitest';

import { addBusinessDays, findCandidates, isOverdue } from './reconcile';
import type { ReconcileTransaction } from './reconcile';

const manual: ReconcileTransaction = {
  id: 'manual',
  date: '2026-10-09',
  amount: -2500,
  account: 'ce',
  label: 'Boulangerie Pradier',
};

function bank(
  id: string,
  date: string,
  amount: number,
  label = 'CB X',
  account = 'ce',
): ReconcileTransaction {
  return { id, date, amount, account, label };
}

describe('addBusinessDays', () => {
  it('skips the weekend', () => {
    // 2026-10-09 is a Friday.
    expect(addBusinessDays('2026-10-09', 1)).toBe('2026-10-12');
    expect(addBusinessDays('2026-10-09', 3)).toBe('2026-10-14');
  });
});

describe('isOverdue', () => {
  it('waits the given working days', () => {
    expect(isOverdue('2026-10-09', '2026-10-13', 3)).toBe(false);
    expect(isOverdue('2026-10-09', '2026-10-14', 3)).toBe(true);
  });
});

describe('findCandidates', () => {
  it('ranks the exact amount first', () => {
    const result = findCandidates(manual, [
      bank('close', '2026-10-10', -2600),
      bank('exact', '2026-10-12', -2500),
    ]);
    expect(result[0].transactions[0].id).toBe('exact');
    expect(result[0].exact).toBe(true);
  });

  it('accepts a tip but not a different purchase', () => {
    const result = findCandidates(manual, [
      bank('tip', '2026-10-10', -2800),
      bank('other', '2026-10-10', -9000),
    ]);
    expect(result.map(c => c.transactions[0].id)).toEqual(['tip']);
  });

  it('prefers a matching merchant name', () => {
    const result = findCandidates(manual, [
      bank('a', '2026-10-10', -2700, 'CB MONOPRIX'),
      bank('b', '2026-10-10', -2700, 'CB PRADIER'),
    ]);
    expect(result[0].transactions[0].id).toBe('b');
  });

  it('ignores lines outside the date window or of the other sign', () => {
    const result = findCandidates(manual, [
      bank('early', '2026-10-01', -2500),
      bank('late', '2026-10-25', -2500),
      bank('refund', '2026-10-10', 2500),
    ]);
    expect(result).toEqual([]);
  });

  it('finds an order billed in two parts', () => {
    const result = findCandidates(manual, [
      bank('part1', '2026-10-10', -1000),
      bank('part2', '2026-10-11', -1500),
    ]);
    const combo = result.find(c => c.transactions.length === 2);
    expect(combo?.transactions.map(t => t.id).sort()).toEqual([
      'part1',
      'part2',
    ]);
  });

  it('puts an exact split order of the same merchant before a close single line', () => {
    const order = { ...manual, label: 'Amazon', date: '2026-10-08' };
    const result = findCandidates(order, [
      bank('close', '2026-10-12', -2650, 'CB PRADIER'),
      bank('part1', '2026-10-13', -1000, 'CB AMAZON PAYMENTS'),
      bank('part2', '2026-10-14', -1500, 'CB AMAZON PAYMENTS'),
    ]);
    expect(result[0].transactions).toHaveLength(2);
  });

  it('only takes the exact amount from another account', () => {
    const result = findCandidates(manual, [
      bank('paypal', '2026-10-10', -2299, 'Uber', 'paypal'),
    ]);
    expect(result).toEqual([]);
  });

  it('still shows the right amount on the other account', () => {
    const result = findCandidates(manual, [
      bank('paypal', '2026-10-10', -2500, 'Pradier', 'paypal'),
    ]);
    expect(result[0].transactions[0].id).toBe('paypal');
  });
});
