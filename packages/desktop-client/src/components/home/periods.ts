// The date ranges of the "all transactions" page. Offset 0 is the current period, 1 the one
// before, and so on.

export type PeriodUnit = 'days' | 'weeks' | 'months' | 'years';

export type Period = { start: string; end: string; label: string };

const DAY = 86_400_000;
const LAST_DAYS = 30;

function toTime(date: string) {
  return Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
  );
}

function toDate(time: number) {
  return new Date(time).toISOString().slice(0, 10);
}

function shift(date: string, days: number) {
  return toDate(toTime(date) + days * DAY);
}

const dayMonth = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const monthYear = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function short(date: string) {
  return dayMonth.format(new Date(toTime(date)));
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function periodFor(
  unit: PeriodUnit,
  offset: number,
  today: string,
): Period {
  if (unit === 'days') {
    const end = shift(today, -offset * LAST_DAYS);
    const start = shift(end, -(LAST_DAYS - 1));
    return {
      start,
      end,
      label:
        offset === 0
          ? `${LAST_DAYS} derniers jours`
          : `Du ${short(start)} au ${short(end)}`,
    };
  }
  if (unit === 'weeks') {
    // Weeks start on Monday in France.
    const weekday = (new Date(toTime(today)).getUTCDay() + 6) % 7;
    const start = shift(today, -weekday - offset * 7);
    const end = shift(start, 6);
    return {
      start,
      end,
      label:
        offset === 0
          ? 'Cette semaine'
          : offset === 1
            ? 'Semaine dernière'
            : `Semaine du ${short(start)}`,
    };
  }
  if (unit === 'months') {
    const total =
      Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7)) - 1 - offset;
    const year = Math.floor(total / 12);
    const month = (total % 12) + 1;
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = toDate(Date.UTC(year, month, 0));
    return {
      start,
      end,
      label:
        offset === 0
          ? 'Ce mois-ci'
          : capitalize(monthYear.format(new Date(toTime(start)))),
    };
  }
  const year = Number(today.slice(0, 4)) - offset;
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
    label: offset === 0 ? 'Cette année' : String(year),
  };
}
