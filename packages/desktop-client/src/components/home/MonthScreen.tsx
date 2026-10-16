import React, { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import type { TransactionEntity } from '@actual-app/core/types/models';
import { ChevronLeft, ChevronRight, PiggyBank } from 'lucide-react';

import { useCategoriesById } from '#hooks/useCategories';
import { useQuery } from '#hooks/useQuery';

import { ProgressBar } from './BudgetScreen';
import { accent, categoryLook, radius } from './design';
import {
  Card,
  CategoryTile,
  ScreenHeader,
  SectionTitle,
  Sheet,
} from './layout';
import { columns, useLayoutMode } from './responsive';
import {
  formatAmount,
  useCategoryBudgets,
  useDailyBudget,
  useMonthlyBudget,
  useSpending,
} from './spending';
import { useIsSubscription } from './subscriptions';
import { TransactionList } from './TransactionList';
import { TransactionSheet } from './TransactionSheet';

function MonthSwitcher({
  month,
  onChange,
}: {
  month: string;
  onChange: (month: string) => void;
}) {
  const isCurrent = month === monthUtils.currentMonth();
  const arrow = {
    border: 'none',
    background: 'rgba(255, 255, 255, 0.06)',
    color: theme.pageText,
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  };
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <button
        type="button"
        aria-label="Mois précédent"
        style={arrow}
        onClick={() => onChange(monthUtils.subMonths(month, 1))}
      >
        <ChevronLeft size={20} />
      </button>
      <button
        type="button"
        aria-label="Mois suivant"
        style={{ ...arrow, opacity: isCurrent ? 0.3 : 1 }}
        onClick={() => !isCurrent && onChange(monthUtils.addMonths(month, 1))}
      >
        <ChevronRight size={20} />
      </button>
    </View>
  );
}

export function MonthScreen() {
  const [month, setMonth] = useState(monthUtils.currentMonth());
  const mode = useLayoutMode();
  const [monthlyBudget] = useMonthlyBudget();
  const [dailyBudget] = useDailyBudget();
  const { transactions, total } = useSpending({
    date: { $transform: '$month', $eq: month },
  });
  const { data: categories } = useCategoriesById();
  const [budgets] = useCategoryBudgets();
  const [openCategory, setOpenCategory] = useState<{
    key: string;
    name: string;
  } | null>(null);
  const [editing, setEditing] = useState<TransactionEntity | null>(null);
  const { data: incomeLines } = useQuery<TransactionEntity>(
    () =>
      q('transactions')
        .filter({
          'account.offbudget': false,
          amount: { $gt: 0 },
          transfer_id: null,
          starting_balance_flag: false,
          date: { $transform: '$month', $eq: month },
        })
        .select('*')
        .options({ splits: 'inline' }),
    [month],
  );
  const received = (incomeLines ?? []).reduce((sum, t) => sum + t.amount, 0);
  const openLines = openCategory
    ? transactions
        .filter(t => (t.category ?? 'none') === openCategory.key)
        .sort((a, b) => b.date.localeCompare(a.date))
    : [];

  const today = monthUtils.currentDay();
  const daysInMonth = Number(
    monthUtils.getMonthEnd(`${month}-01`).slice(8, 10),
  );
  const isCurrent = month === monthUtils.currentMonth();
  const monthsAgo = monthUtils.differenceInCalendarMonths(
    monthUtils.currentMonth(),
    month,
  );
  const elapsed = isCurrent ? Number(today.slice(8, 10)) : daysInMonth;
  const left = monthlyBudget - total;

  // The bars are measured against the daily budget, which subscriptions stay out of.
  const isSubscription = useIsSubscription();
  const perDay = Array.from({ length: daysInMonth }, () => 0);
  for (const t of transactions) {
    if (!isSubscription(t)) perDay[Number(t.date.slice(8, 10)) - 1] -= t.amount;
  }
  const tallest = Math.max(dailyBudget * 1.5, ...perDay);

  const byCategory = useMemo(() => {
    const sums = new Map<string, { name: string; amount: number }>();
    for (const t of transactions) {
      const key = t.category ?? 'none';
      const name =
        (t.category && categories?.list[t.category]?.name) || 'Sans catégorie';
      const entry = sums.get(key) ?? { name, amount: 0 };
      entry.amount -= t.amount;
      sums.set(key, entry);
    }
    return [...sums.entries()].sort((a, b) => b[1].amount - a[1].amount);
  }, [transactions, categories]);

  const title = new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
  })
    .format(new Date(`${month}-15T12:00:00`))
    .replace(/^./, c => c.toUpperCase());
  const ratio = monthlyBudget > 0 ? total / monthlyBudget : 1;

  return (
    <View style={{ gap: mode === 'phone' ? 16 : 28 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <ScreenHeader overline="Ce mois-ci" title={title} />
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Link
            to="/home/budget"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 36,
              padding: '0 14px',
              borderRadius: radius.pill,
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              color: theme.pageText,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <PiggyBank size={16} color={accent} />
            Budget
          </Link>
          <MonthSwitcher month={month} onChange={setMonth} />
        </View>
      </View>

      <View style={columns(mode, mode === 'desktop' ? '1fr 1.5fr' : '1fr')}>
        <Card style={{ gap: 14 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <Text
              style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1.2 }}
            >
              {formatAmount(total)}
            </Text>
            <Text style={{ fontSize: 15, color: theme.pageTextSubdued }}>
              sur {formatAmount(monthlyBudget)}
            </Text>
          </View>
          <View
            style={{
              height: 10,
              borderRadius: radius.pill,
              backgroundColor: 'rgba(255, 255, 255, 0.07)',
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${Math.min(ratio, 1) * 100}%`,
                height: '100%',
                borderRadius: radius.pill,
                backgroundColor: ratio > 1 ? theme.numberNegative : accent,
                transition: 'width 600ms ease',
              }}
            />
          </View>
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between' }}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: left < 0 ? theme.numberNegative : theme.numberPositive,
              }}
            >
              {left < 0
                ? `Dépassé de ${formatAmount(-left)}`
                : `Reste ${formatAmount(left)}`}
            </Text>
            <Text style={{ fontSize: 14, color: theme.pageTextSubdued }}>
              {isCurrent
                ? `${daysInMonth - elapsed} jours restants`
                : 'Mois terminé'}
            </Text>
          </View>
          {received > 0 && (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingTop: 12,
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <Text style={{ fontSize: 14, color: theme.pageTextSubdued }}>
                Rentrées du mois
              </Text>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: theme.numberPositive,
                }}
              >
                + {formatAmount(received)}
              </Text>
            </View>
          )}
        </Card>

        <View style={{ gap: 10 }}>
          {mode === 'phone' && <SectionTitle>Jour par jour</SectionTitle>}
          <Card style={{ padding: '18px 14px 12px' }}>
            <View
              style={{
                position: 'relative',
                height: mode === 'phone' ? 120 : 170,
              }}
            >
              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: `${(dailyBudget / tallest) * 100}%`,
                  borderTop: `1px dashed ${theme.pageTextSubdued}`,
                  opacity: 0.5,
                }}
              />
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-end',
                  gap: 3,
                  height: '100%',
                }}
              >
                {perDay.map((value, index) => (
                  <View
                    key={index}
                    title={`${index + 1} : ${formatAmount(value)}`}
                    style={{
                      flex: 1,
                      height: `${Math.max(
                        (value / tallest) * 100,
                        value > 0 ? 3 : 1.5,
                      )}%`,
                      borderRadius: 4,
                      backgroundColor:
                        value > dailyBudget
                          ? theme.numberNegative
                          : value > 0
                            ? accent
                            : 'rgba(255, 255, 255, 0.08)',
                      opacity: isCurrent && index + 1 > elapsed ? 0.35 : 1,
                    }}
                  />
                ))}
              </View>
            </View>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginTop: 8,
              }}
            >
              <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
                1
              </Text>
              <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
                Ligne : {formatAmount(dailyBudget)} par jour
              </Text>
              <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
                {daysInMonth}
              </Text>
            </View>
          </Card>
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <SectionTitle>Par catégorie</SectionTitle>
          <Link
            to={`/home/transactions?unit=months${
              monthsAgo > 0 ? `&offset=${monthsAgo}` : ''
            }`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              padding: '8px 4px 0',
              color: accent,
              textDecoration: 'none',
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            Toutes les opérations
            <ChevronRight size={18} />
          </Link>
        </View>
        <Card
          style={{
            padding: 6,
            display: mode === 'phone' ? 'flex' : 'grid',
            gridTemplateColumns: mode === 'desktop' ? '1fr 1fr' : undefined,
            columnGap: 12,
          }}
        >
          {byCategory.length === 0 ? (
            <Text
              style={{
                padding: 16,
                color: theme.pageTextSubdued,
                fontSize: 15,
              }}
            >
              Aucune dépense ce mois-ci.
            </Text>
          ) : (
            byCategory.map(([key, { name, amount }]) => (
              <button
                key={key}
                type="button"
                onClick={() => setOpenCategory({ key, name })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  border: 'none',
                  borderRadius: 16,
                  background: 'transparent',
                  color: theme.pageText,
                  textAlign: 'left',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                <CategoryTile name={name} />
                <View style={{ flex: 1, gap: 6 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: 500 }}>
                      {name}
                    </Text>
                    <Text style={{ fontSize: 16, fontWeight: 600 }}>
                      {formatAmount(amount)}
                      {budgets[key] != null && (
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: theme.pageTextSubdued,
                          }}
                        >
                          {` / ${formatAmount(budgets[key])}`}
                        </Text>
                      )}
                    </Text>
                  </View>
                  {/* Against its own limit when it has one, else its share of the month. */}
                  <ProgressBar
                    ratio={
                      budgets[key] != null
                        ? amount / budgets[key]
                        : amount / total
                    }
                    color={categoryLook(name).color}
                  />
                </View>
              </button>
            ))
          )}
        </Card>
      </View>

      {openCategory && !editing && (
        <Sheet
          title={`${openCategory.name} · ${formatAmount(
            openLines.reduce((sum, t) => sum - t.amount, 0),
          )}`}
          centered={mode !== 'phone'}
          onClose={() => setOpenCategory(null)}
        >
          <View style={{ margin: '0 -12px' }}>
            <TransactionList
              transactions={openLines}
              showDate
              empty="Aucune dépense."
              onSelect={setEditing}
            />
          </View>
        </Sheet>
      )}
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
