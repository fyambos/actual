import { explainTransfers, transferPurpose, withPurpose } from './transfers';

describe('transferPurpose', () => {
  it('reads the purpose after the bank reference', () => {
    expect(
      transferPurpose('1046102862730 PAYPAL | Pour : Uber Eats du 11/10/2026'),
    ).toBe('Uber Eats du 11/10/2026');
  });

  it('reads a purpose written alone', () => {
    expect(transferPurpose('Pour : approvisionnement du solde PayPal')).toBe(
      'approvisionnement du solde PayPal',
    );
  });

  it('returns null without a purpose', () => {
    expect(transferPurpose('1031791306051 PAYPAL')).toBeNull();
    expect(transferPurpose(null)).toBeNull();
  });
});

describe('explainTransfers', () => {
  const accounts = [
    { id: 'bank', name: "Caisse d'Épargne", offbudget: false },
    { id: 'paypal', name: 'PayPal', offbudget: false },
    { id: 'credit', name: 'Crédit PayPal', offbudget: false },
    { id: 'livret', name: 'Livret A', offbudget: true },
  ];
  const line = (
    id: string,
    date: string,
    amount: number,
    account: string,
    transfer?: [string, string],
    name = '',
  ) => ({
    id,
    date,
    amount,
    account,
    transferId: transfer?.[0] ?? null,
    toAccount: transfer?.[1] ?? null,
    name,
    notes: null,
  });

  it('finds the PayPal purchase a bank debit paid for', () => {
    const purposes = explainTransfers(
      [
        line('buy', '2026-10-11', -5485, 'paypal', undefined, 'Uber Eats'),
        line('out', '2026-10-13', -5485, 'bank', ['in', 'paypal']),
        line('in', '2026-10-13', 5485, 'paypal', ['out', 'bank']),
      ],
      accounts,
    );
    expect(purposes.get('out')).toBe('Uber Eats du 11 oct.');
    expect(purposes.get('in')).toBe('Uber Eats du 11 oct.');
  });

  it('recognises a Paiement en 4X instalment passed on to the credit account', () => {
    const purposes = explainTransfers(
      [
        line('pay', '2024-06-26', -2500, 'paypal', ['cr', 'credit']),
        line('cr', '2024-06-26', 2500, 'credit', ['pay', 'paypal']),
        line('out', '2024-06-27', -2500, 'bank', ['in', 'paypal']),
        line('in', '2024-06-27', 2500, 'paypal', ['out', 'bank']),
      ],
      accounts,
    );
    expect(purposes.get('out')).toBe('Échéance Crédit PayPal (Paiement en 4X)');
    expect(purposes.get('pay')).toBe('Remboursement Crédit PayPal');
  });

  it('explains savings, and leaves an unmatched debit unexplained', () => {
    const purposes = explainTransfers(
      [
        line('save', '2026-10-05', -4500, 'bank', ['l', 'livret']),
        line('out', '2026-10-02', -4152, 'bank', ['in', 'paypal']),
        line('buy', '2026-09-20', -4152, 'paypal', undefined, 'Old'),
      ],
      accounts,
    );
    expect(purposes.get('save')).toBe('Livret A');
    expect(purposes.get('out')).toBeNull();
  });

  it('explains money taken from savings and a PayPal balance sent back', () => {
    const purposes = explainTransfers(
      [
        line('take', '2026-04-29', -50000, 'livret', ['back', 'bank']),
        line('back', '2026-04-29', 50000, 'bank', ['take', 'livret']),
        line('buy', '2026-10-01', -2000, 'paypal', undefined, 'Steam'),
        line('top', '2026-10-03', -2000, 'bank', ['topIn', 'paypal']),
        line('topIn', '2026-10-03', 2000, 'paypal', ['top', 'bank']),
        line('home', '2026-10-12', -272, 'paypal', ['homeIn', 'bank']),
        line('homeIn', '2026-10-12', 272, 'bank', ['home', 'paypal']),
      ],
      accounts,
    );
    expect(purposes.get('take')).toBe('Depuis Livret A');
    expect(purposes.get('home')).toBe('Solde PayPal reversé');
  });
});

describe('withPurpose', () => {
  it('adds the purpose after the bank reference, or replaces it', () => {
    expect(withPurpose('1047 PAYPAL', 'Cadeau')).toBe(
      '1047 PAYPAL | Pour : Cadeau',
    );
    expect(withPurpose('1047 PAYPAL | Pour : Old', 'New')).toBe(
      '1047 PAYPAL | Pour : New',
    );
    expect(withPurpose(null, 'Cadeau')).toBe('Pour : Cadeau');
  });
});
