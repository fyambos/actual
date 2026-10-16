import React, { useEffect, useState } from 'react';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { accent } from './design';
import { Card, fieldStyle } from './layout';

export function NumberSetting({
  label,
  hint,
  value,
  unit,
  decimals,
  onSave,
}: {
  label: string;
  hint: string;
  value: number;
  unit: string;
  decimals: boolean;
  onSave: (value: number) => void;
}) {
  const [text, setText] = useState(String(value).replace('.', ','));
  const [saved, setSaved] = useState(false);

  // The stored value may load after the first render.
  useEffect(() => {
    setText(String(value).replace('.', ','));
  }, [value]);
  const parsed = Number(text.replace(/\s/g, '').replace(',', '.'));
  const valid =
    Number.isFinite(parsed) &&
    parsed > 0 &&
    (decimals || Number.isInteger(parsed));
  const changed = valid && parsed !== value;

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 16, fontWeight: 600 }}>{label}</Text>
        <Text style={{ fontSize: 13, color: theme.pageTextSubdued }}>
          {hint}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <input
          inputMode={decimals ? 'decimal' : 'numeric'}
          aria-label={label}
          value={text}
          onChange={event => {
            setText(event.target.value);
            setSaved(false);
          }}
          onKeyDown={event => {
            if (event.key === 'Enter' && changed) {
              onSave(parsed);
              setSaved(true);
            }
          }}
          style={{ ...fieldStyle, flex: 1, fontSize: 20, fontWeight: 600 }}
        />
        <Text style={{ fontSize: 16, color: theme.pageTextSubdued }}>
          {unit}
        </Text>
        <button
          type="button"
          disabled={!changed}
          onClick={() => {
            onSave(parsed);
            setSaved(true);
          }}
          style={{
            height: 50,
            padding: '0 18px',
            border: 'none',
            borderRadius: 16,
            backgroundColor: changed ? accent : 'rgba(255, 255, 255, 0.06)',
            color: changed ? '#fff' : theme.pageTextSubdued,
            fontSize: 15,
            fontWeight: 600,
            cursor: changed ? 'pointer' : 'default',
          }}
        >
          {saved && !changed ? 'Enregistré' : 'Enregistrer'}
        </button>
      </View>
      {!valid && (
        <Text style={{ fontSize: 13, color: theme.numberNegative }}>
          {decimals ? 'Entre un montant positif' : 'Entre un nombre entier'}
        </Text>
      )}
    </Card>
  );
}
