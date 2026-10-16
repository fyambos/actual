import React, { useMemo, useState } from 'react';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { currentMonth } from '@actual-app/core/shared/months';

import { useCategories } from '#hooks/useCategories';

import { accent, categoryLook, radius } from './design';
import {
  Card,
  CategoryTile,
  fieldStyle,
  ScreenHeader,
  SectionTitle,
} from './layout';
import { NumberSetting } from './NumberSetting';
import { columns, useLayoutMode } from './responsive';
import {
  formatAmount,
  useCategoryBudgets,
  useDailyBudget,
  useMonthlyBudget,
  useSpending,
} from './spending';

export function ProgressBar({
  ratio,
  color,
}: {
  ratio: number;
  color: string;
}) {
  return (
    <View
      style={{
        height: 5,
        borderRadius: radius.pill,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${Math.min(ratio, 1) * 100}%`,
          height: '100%',
          borderRadius: radius.pill,
          backgroundColor: ratio > 1 ? theme.numberNegative : color,
        }}
      />
    </View>
  );
}

function CategoryBudgetRow({
  id,
  name,
  spent,
  budget,
  onSave,
}: {
  id: string;
  name: string;
  spent: number;
  budget: number | undefined;
  onSave: (id: string, euros: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const { color } = categoryLook(name);

  function commit() {
    const value = Number(text.replace(/\s/g, '').replace(',', '.'));
    if (text.trim() === '' || value === 0) onSave(id, null);
    else if (Number.isFinite(value) && value > 0) onSave(id, value);
    setEditing(false);
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
      }}
    >
      <CategoryTile name={name} />
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: 500 }}>{name}</Text>
          {editing ? (
            <input
              // The field appears because the row was tapped to edit it.
              ref={input => input?.focus()}
              inputMode="decimal"
              aria-label={`Budget ${name}`}
              placeholder="€ par mois"
              value={text}
              onChange={event => setText(event.target.value)}
              onBlur={commit}
              onKeyDown={event => {
                if (event.key === 'Enter') commit();
                if (event.key === 'Escape') setEditing(false);
              }}
              style={{
                ...fieldStyle,
                width: 110,
                padding: '6px 10px',
                fontSize: 15,
                textAlign: 'right',
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setText(budget ? String(budget / 100).replace('.', ',') : '');
                setEditing(true);
              }}
              style={{
                border: 'none',
                background: 'transparent',
                color: budget ? theme.pageText : accent,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
                whiteSpace: 'nowrap',
              }}
            >
              {budget
                ? `${formatAmount(spent)} / ${formatAmount(budget)}`
                : `${formatAmount(spent)} · Fixer`}
            </button>
          )}
        </View>
        {budget != null && <ProgressBar ratio={spent / budget} color={color} />}
      </View>
    </View>
  );
}

export function BudgetScreen() {
  const mode = useLayoutMode();
  const month = currentMonth();
  const [daily, setDaily] = useDailyBudget();
  const [monthly, setMonthly] = useMonthlyBudget();
  const [budgets, setBudget] = useCategoryBudgets();
  const { data: categories } = useCategories();
  const { transactions } = useSpending({
    date: { $transform: '$month', $eq: month },
  });

  const spentBy = useMemo(() => {
    const sums = new Map<string, number>();
    for (const t of transactions) {
      if (t.category) {
        sums.set(t.category, (sums.get(t.category) ?? 0) - t.amount);
      }
    }
    return sums;
  }, [transactions]);

  const groups = (categories?.grouped ?? [])
    .filter(g => !g.hidden && !g.is_income)
    .map(g => ({
      ...g,
      categories: (g.categories ?? [])
        .filter(c => !c.hidden)
        .sort(
          (a, b) =>
            Number(b.id in budgets) - Number(a.id in budgets) ||
            (spentBy.get(b.id) ?? 0) - (spentBy.get(a.id) ?? 0),
        ),
    }))
    .filter(g => g.categories.length > 0);

  const planned = Object.values(budgets).reduce((sum, v) => sum + v, 0);

  return (
    <View style={{ gap: mode === 'phone' ? 16 : 28 }}>
      <ScreenHeader
        back={{ to: '/home/month', label: 'Mois' }}
        overline="Tes limites"
        title="Budget"
      />
      <View style={columns(mode, '1fr 1fr')}>
        <NumberSetting
          label="Budget du jour"
          hint="Le cercle d'Aujourd'hui se remplit jusqu'à ce montant."
          value={daily / 100}
          unit="€"
          decimals
          onSave={value => setDaily(value)}
        />
        <NumberSetting
          label="Budget du mois"
          hint="Toutes catégories confondues, hors épargne et virements internes."
          value={monthly / 100}
          unit="€"
          decimals
          onSave={value => setMonthly(value)}
        />
      </View>

      <View style={{ gap: 10 }}>
        <SectionTitle>Par catégorie, ce mois-ci</SectionTitle>
        <Text
          style={{
            fontSize: 13,
            color: theme.pageTextSubdued,
            padding: '0 4px',
          }}
        >
          Touche un montant pour fixer une limite mensuelle. Laisse vide pour
          l'enlever.
          {planned > 0 &&
            ` ${formatAmount(planned)} répartis sur ${formatAmount(monthly)}.`}
        </Text>
        <View style={columns(mode, mode === 'desktop' ? '1fr 1fr' : '1fr')}>
          {groups.map(group => (
            <View key={group.id} style={{ gap: 8 }}>
              <SectionTitle>{group.name}</SectionTitle>
              <Card style={{ padding: 6 }}>
                {group.categories.map(category => (
                  <CategoryBudgetRow
                    key={category.id}
                    id={category.id}
                    name={category.name}
                    spent={spentBy.get(category.id) ?? 0}
                    budget={budgets[category.id]}
                    onSave={setBudget}
                  />
                ))}
              </Card>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
