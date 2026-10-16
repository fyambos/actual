import React from 'react';
import { Link } from 'react-router';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { ChevronRight, LayoutGrid, PiggyBank } from 'lucide-react';

import { accent } from './design';
import { useReconcileDays } from './entries';
import { ScreenHeader, SectionTitle } from './layout';
import { NumberSetting } from './NumberSetting';
import { columns, useLayoutMode } from './responsive';

function LinkRow({
  to,
  icon: Icon,
  title,
  hint,
}: {
  to: string;
  icon: typeof PiggyBank;
  title: string;
  hint: string;
}) {
  return (
    <Link
      to={to}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '16px 18px',
        borderRadius: 24,
        backgroundColor: theme.cardBackground,
        border: '1px solid rgba(255, 255, 255, 0.06)',
        color: theme.pageText,
        textDecoration: 'none',
      }}
    >
      <Icon size={20} color={accent} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 16, fontWeight: 600 }}>{title}</Text>
        <Text style={{ fontSize: 13, color: theme.pageTextSubdued }}>
          {hint}
        </Text>
      </View>
      <ChevronRight size={18} color={theme.pageTextSubdued} />
    </Link>
  );
}

export function SettingsScreen() {
  const mode = useLayoutMode();
  const [days, setDays] = useReconcileDays();

  return (
    <View style={{ gap: mode === 'phone' ? 16 : 28 }}>
      <ScreenHeader
        back={{ to: '/home/accounts', label: 'Comptes' }}
        title="Réglages"
      />
      <View style={columns(mode, '1fr 1fr')}>
        <LinkRow
          to="/home/budget"
          icon={PiggyBank}
          title="Budget"
          hint="Budget du jour, du mois et par catégorie"
        />
        <LinkRow
          to="/budget"
          icon={LayoutGrid}
          title="Vue avancée"
          hint="Toutes les vues d'Actual : règles, bénéficiaires, rapports"
        />
      </View>
      <View style={{ gap: 10 }}>
        <SectionTitle>Rapprochement</SectionTitle>
        <View style={columns(mode, '1fr 1fr')}>
          <NumberSetting
            label="Délai avant de rapprocher"
            hint="Après ce nombre de jours ouvrés (week-ends exclus), une saisie que la banque n'a pas confirmée, ou un virement dont l'achat est introuvable, arrive dans « À traiter ». Une carte ou PayPal met en général 1 à 3 jours."
            value={days}
            unit="jours"
            decimals={false}
            onSave={value => setDays(value)}
          />
        </View>
      </View>
    </View>
  );
}
