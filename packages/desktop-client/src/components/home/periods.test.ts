import { describe, expect, it } from 'vitest';

import { periodFor } from './periods';

// 2026-10-16 is a Friday.
const today = '2026-10-16';

describe('periodFor', () => {
  it('covers the last 30 days, then the 30 before', () => {
    expect(periodFor('days', 0, today)).toMatchObject({
      start: '2026-09-17',
      end: '2026-10-16',
      label: '30 derniers jours',
    });
    expect(periodFor('days', 1, today)).toMatchObject({
      start: '2026-08-18',
      end: '2026-09-16',
    });
  });

  it('starts weeks on Monday', () => {
    expect(periodFor('weeks', 0, today)).toMatchObject({
      start: '2026-10-12',
      end: '2026-10-18',
      label: 'Cette semaine',
    });
    expect(periodFor('weeks', 1, today).label).toBe('Semaine dernière');
  });

  it('crosses year boundaries for months', () => {
    expect(periodFor('months', 0, today)).toMatchObject({
      start: '2026-10-01',
      end: '2026-10-31',
      label: 'Ce mois-ci',
    });
    expect(periodFor('months', 10, today)).toMatchObject({
      start: '2025-12-01',
      end: '2025-12-31',
      label: 'Décembre 2025',
    });
    expect(periodFor('months', 8, today).end).toBe('2026-02-28');
  });

  it('covers whole years', () => {
    expect(periodFor('years', 0, today).label).toBe('Cette année');
    expect(periodFor('years', 2, today)).toMatchObject({
      start: '2024-01-01',
      end: '2024-12-31',
      label: '2024',
    });
  });
});
