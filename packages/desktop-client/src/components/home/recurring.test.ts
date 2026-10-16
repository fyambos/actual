import {
  detectSubscriptions,
  matchesSubscription,
  merchantName,
} from './recurring';

describe('merchantName', () => {
  it('drops the card prefix, invoice date and currency', () => {
    expect(merchantName('CB APPLE.COM/BILL  FACT 160726   344401******9')).toBe(
      'APPLE.COM/BILL',
    );
    expect(merchantName('CB RAILWAY FACT 040926 (EN USD 7,04)')).toBe(
      'RAILWAY',
    );
    expect(merchantName('Spotify AB')).toBe('Spotify AB');
  });
});

describe('detectSubscriptions', () => {
  const monthly = (name: string, amount: number, dates: string[]) =>
    dates.map(date => ({ name, amount, date }));

  it('finds a monthly charge that is still running', () => {
    const found = detectSubscriptions(
      monthly('Spotify', 1214, ['2026-07-17', '2026-08-17', '2026-09-17']),
      '2026-10-10',
    );
    expect(found).toEqual([
      expect.objectContaining({
        name: 'Spotify',
        amount: 1214,
        period: 'monthly',
        nextDate: '2026-10-17',
      }),
    ]);
  });

  it('keeps two plans from the same merchant apart', () => {
    const found = detectSubscriptions(
      [
        ...monthly('Apple', 299, ['2026-07-11', '2026-08-11', '2026-09-11']),
        ...monthly('Apple', 1099, ['2026-07-16', '2026-08-16', '2026-09-16']),
      ],
      '2026-10-01',
    );
    expect(found.map(s => s.amount)).toEqual([1099, 299]);
  });

  it('treats small currency swings as the same plan', () => {
    const found = detectSubscriptions(
      [
        { name: 'GitHub', amount: 879, date: '2026-01-28' },
        { name: 'GitHub', amount: 906, date: '2026-02-28' },
        { name: 'GitHub', amount: 918, date: '2026-03-28' },
      ],
      '2026-04-10',
    );
    expect(found).toHaveLength(1);
  });

  it('keeps a plan that stopped, marked as ended', () => {
    const found = detectSubscriptions(
      monthly('Netflix', 799, ['2026-01-08', '2026-02-08', '2026-03-08']),
      '2026-10-01',
    );
    expect(found).toEqual([
      expect.objectContaining({
        name: 'Netflix',
        active: false,
        firstDate: '2026-01-08',
        lastDate: '2026-03-08',
        total: 2397,
      }),
    ]);
  });

  it('finds a plan billed by usage, whose amount changes every month', () => {
    const found = detectSubscriptions(
      [
        { name: 'Railway', amount: 616, date: '2026-07-06' },
        { name: 'Railway', amount: 714, date: '2026-08-06' },
        { name: 'Railway', amount: 88, date: '2026-09-07' },
        { name: 'Railway', amount: 762, date: '2026-10-06' },
      ],
      '2026-10-16',
    );
    expect(found).toEqual([
      expect.objectContaining({
        name: 'Railway',
        variable: true,
        active: true,
        nextDate: '2026-11-06',
      }),
    ]);
  });

  it('follows a price that drifted instead of stopping at the old one', () => {
    const found = detectSubscriptions(
      [
        { name: 'DigitalOcean', amount: 3885, date: '2026-07-01' },
        { name: 'DigitalOcean', amount: 3861, date: '2026-08-01' },
        { name: 'DigitalOcean', amount: 4077, date: '2026-09-01' },
        { name: 'DigitalOcean', amount: 4513, date: '2026-10-01' },
      ],
      '2026-10-16',
    );
    expect(found).toEqual([
      expect.objectContaining({
        lastDate: '2026-10-01',
        nextDate: '2026-11-01',
      }),
    ]);
  });

  it('ignores everyday shops that happen to recur', () => {
    const found = detectSubscriptions(
      [
        {
          name: 'Boulangerie',
          amount: 620,
          date: '2024-10-01',
          category: 'Supermarché / Épicerie',
        },
        {
          name: 'Boulangerie',
          amount: 620,
          date: '2025-10-01',
          category: 'Supermarché / Épicerie',
        },
      ],
      '2026-01-01',
    );
    expect(found).toEqual([]);
  });

  it('ignores frequent everyday purchases at a similar price', () => {
    const dates = Array.from({ length: 40 }, (_, i) => {
      const date = new Date(Date.UTC(2026, 0, 1 + i * 9));
      return date.toISOString().slice(0, 10);
    });
    const found = detectSubscriptions(
      monthly('Uber Eats', 2900, dates),
      '2026-12-10',
    );
    expect(found).toEqual([]);
  });

  it('tolerates one missed month', () => {
    const found = detectSubscriptions(
      monthly('Spotify', 1214, [
        '2026-05-17',
        '2026-06-17',
        '2026-08-17',
        '2026-09-17',
      ]),
      '2026-10-01',
    );
    expect(found).toHaveLength(1);
  });

  it('ignores irregular purchases', () => {
    const found = detectSubscriptions(
      monthly('Uber', 1500, ['2026-09-01', '2026-09-03', '2026-09-20']),
      '2026-09-25',
    );
    expect(found).toEqual([]);
  });
});

describe('matchesSubscription', () => {
  const monthly = (name: string, amount: number, dates: string[]) =>
    dates.map(date => ({ date, amount, name }));
  const plans = detectSubscriptions(
    monthly('Uber One', 599, ['2026-07-03', '2026-08-03', '2026-09-03']),
    '2026-10-01',
  );

  it('matches a charge of the same merchant and amount', () => {
    expect(matchesSubscription({ name: 'uber one', amount: 599 }, plans)).toBe(
      true,
    );
  });

  it('ignores another amount or merchant', () => {
    expect(matchesSubscription({ name: 'Uber One', amount: 2599 }, plans)).toBe(
      false,
    );
    expect(matchesSubscription({ name: 'Uber Eats', amount: 599 }, plans)).toBe(
      false,
    );
  });

  it('finds a plan hidden among other fees of a similar amount', () => {
    const fees = ['2026-06-04', '2026-07-06', '2026-08-04', '2026-09-04'].map(
      date => ({ name: 'Banque', amount: 270, date }),
    );
    const found = detectSubscriptions(
      [
        ...fees,
        { name: 'Banque', amount: 280, date: '2026-07-20' },
        { name: 'Banque', amount: 290, date: '2026-08-11' },
      ],
      '2026-09-20',
    );
    expect(found).toEqual([
      expect.objectContaining({ amount: 270, active: true }),
    ]);
  });
});
