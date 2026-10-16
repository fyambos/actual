import React, { useId } from 'react';

import { theme } from '@actual-app/components/theme';

import { accent } from './design';
import { formatAmount } from './spending';

const SIZE = 220;
const STROKE = 16;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function BudgetRing({
  spent,
  budget,
}: {
  spent: number;
  budget: number;
}) {
  const gradientId = useId();
  const ratio = budget > 0 ? Math.min(spent / budget, 1) : 1;
  const over = spent > budget;
  const left = budget - spent;
  const center = SIZE / 2;
  const tone = over ? theme.numberNegative : accent;

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={`${formatAmount(spent)} dépensés sur ${formatAmount(budget)}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={tone} />
          <stop offset="100%" stopColor={tone} stopOpacity={0.55} />
        </linearGradient>
      </defs>
      <circle
        cx={center}
        cy={center}
        r={RADIUS}
        fill="none"
        stroke="rgba(255, 255, 255, 0.06)"
        strokeWidth={STROKE}
      />
      <circle
        cx={center}
        cy={center}
        r={RADIUS}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={`${CIRCUMFERENCE * ratio} ${CIRCUMFERENCE}`}
        transform={`rotate(-90 ${center} ${center})`}
        style={{ transition: 'stroke-dasharray 600ms ease' }}
      />
      <text
        x={center}
        y={center - 26}
        textAnchor="middle"
        fill={theme.pageTextSubdued}
        fontSize={14}
      >
        {over ? 'Dépassé de' : 'Il te reste'}
      </text>
      <text
        x={center}
        y={center + 14}
        textAnchor="middle"
        fill={over ? theme.numberNegative : theme.pageText}
        fontSize={38}
        fontWeight={700}
        letterSpacing={-1}
      >
        {formatAmount(Math.abs(left))}
      </text>
      <text
        x={center}
        y={center + 42}
        textAnchor="middle"
        fill={theme.pageTextSubdued}
        fontSize={14}
      >
        sur {formatAmount(budget)} aujourd'hui
      </text>
    </svg>
  );
}
