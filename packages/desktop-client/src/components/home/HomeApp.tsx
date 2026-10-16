import React, { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { LucideIcon } from 'lucide-react';
import {
  ChartPie,
  Inbox,
  Landmark,
  LayoutGrid,
  List,
  PiggyBank,
  RefreshCw,
  Repeat,
  Settings,
  Sun,
} from 'lucide-react';

import { AccountsScreen } from './AccountsScreen';
import { BudgetScreen } from './BudgetScreen';
import { accent, hairline, radius } from './design';
import { InboxScreen, useInboxCounts } from './InboxScreen';
import { MonthScreen } from './MonthScreen';
import { useLayoutMode } from './responsive';
import { SettingsScreen } from './SettingsScreen';
import { SubscriptionsScreen } from './SubscriptionsScreen';
import { TodayScreen } from './TodayScreen';
import { TransactionsScreen } from './TransactionsScreen';

const tabs: Array<{ to: string; label: string; icon: LucideIcon }> = [
  { to: '/home', label: "Aujourd'hui", icon: Sun },
  { to: '/home/month', label: 'Mois', icon: ChartPie },
  { to: '/home/subscriptions', label: 'Abonnements', icon: Repeat },
  { to: '/home/accounts', label: 'Comptes', icon: Landmark },
];

// Pages reached from the screens themselves on a phone; listed in the sidebar on wider screens.
const secondary: Array<{
  to: string;
  label: string;
  icon: LucideIcon;
}> = [
  { to: '/home/transactions', label: 'Opérations', icon: List },
  { to: '/home/inbox', label: 'À traiter', icon: Inbox },
  { to: '/home/budget', label: 'Budget', icon: PiggyBank },
  { to: '/home/settings', label: 'Réglages', icon: Settings },
];

function Screens() {
  return (
    <Routes>
      <Route index element={<TodayScreen />} />
      <Route path="month" element={<MonthScreen />} />
      <Route path="subscriptions" element={<SubscriptionsScreen />} />
      <Route path="accounts" element={<AccountsScreen />} />
      <Route path="inbox" element={<InboxScreen />} />
      <Route path="settings" element={<SettingsScreen />} />
      <Route path="budget" element={<BudgetScreen />} />
      <Route path="transactions" element={<TransactionsScreen />} />
    </Routes>
  );
}

function Badge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span
      style={{
        position: 'absolute',
        top: -6,
        right: -10,
        minWidth: 18,
        height: 18,
        padding: '0 5px',
        boxSizing: 'border-box',
        borderRadius: radius.pill,
        backgroundColor: accent,
        color: '#fff',
        fontSize: 11,
        fontWeight: 700,
        lineHeight: '18px',
        textAlign: 'center',
      }}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

function TabIcon({
  icon: Icon,
  size,
  color,
  badge,
}: {
  icon: LucideIcon;
  size: number;
  color?: string;
  badge: number;
}) {
  return (
    <span style={{ position: 'relative', display: 'flex' }}>
      <Icon size={size} strokeWidth={2} color={color} />
      <Badge count={badge} />
    </span>
  );
}

function BottomBar() {
  return (
    <nav
      style={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: 'calc(16px + env(safe-area-inset-bottom))',
        width: 'calc(100% - 32px)',
        maxWidth: 488,
        display: 'flex',
        justifyContent: 'space-around',
        padding: 8,
        borderRadius: 26,
        backgroundColor: 'rgba(18, 18, 20, 0.82)',
        backdropFilter: 'blur(18px)',
        border: '1px solid rgba(255, 255, 255, 0.07)',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)',
        zIndex: 20,
      }}
    >
      {tabs.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end
          style={({ isActive }) => ({
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            padding: '8px 0',
            borderRadius: 18,
            textDecoration: 'none',
            fontSize: 11,
            fontWeight: 500,
            color: isActive ? accent : theme.pageTextSubdued,
            backgroundColor: isActive
              ? 'rgba(255, 255, 255, 0.05)'
              : 'transparent',
          })}
        >
          <Icon size={22} strokeWidth={2} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function SideBar({ compact }: { compact: boolean }) {
  const inbox = useInboxCounts();
  const link = (isActive: boolean) => ({
    display: 'flex',
    flexDirection: compact ? ('column' as const) : ('row' as const),
    alignItems: 'center',
    gap: compact ? 6 : 12,
    padding: compact ? '12px 4px' : '12px 14px',
    borderRadius: 14,
    textDecoration: 'none',
    fontSize: compact ? 11 : 15,
    fontWeight: 500,
    color: isActive ? theme.pageText : theme.pageTextSubdued,
    backgroundColor: isActive ? 'rgba(255, 255, 255, 0.07)' : 'transparent',
  });

  return (
    <nav
      style={{
        width: compact ? 96 : 248,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: compact ? '24px 10px' : '28px 16px',
        borderRight: hairline,
      }}
    >
      {!compact && (
        <Text style={{ fontSize: 20, fontWeight: 700, padding: '0 14px 20px' }}>
          Mon budget
        </Text>
      )}
      {tabs.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end style={({ isActive }) => link(isActive)}>
          {({ isActive }) => (
            <>
              <Icon
                size={compact ? 22 : 20}
                color={isActive ? accent : undefined}
              />
              {label}
            </>
          )}
        </NavLink>
      ))}
      <View style={{ flex: 1 }} />
      {secondary.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end style={({ isActive }) => link(isActive)}>
          {({ isActive }) => (
            <>
              <TabIcon
                icon={Icon}
                size={compact ? 22 : 20}
                color={isActive ? accent : undefined}
                badge={to === '/home/inbox' ? inbox.total : 0}
              />
              {label}
            </>
          )}
        </NavLink>
      ))}
      <NavLink to="/budget" style={() => link(false)}>
        <LayoutGrid size={compact ? 22 : 20} />
        {compact ? 'Avancé' : 'Vue avancée'}
      </NavLink>
    </nav>
  );
}

// A new version is downloaded in the background; it only replaces the open one when asked.
function UpdateBanner() {
  const [ready, setReady] = useState(() =>
    global.Actual.isUpdateReadyForDownload(),
  );
  const [applying, setApplying] = useState(false);
  useEffect(() => {
    let alive = true;
    void global.Actual.waitForUpdateReadyForDownload().then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  if (!ready) return null;
  return (
    <button
      type="button"
      disabled={applying}
      onClick={() => {
        setApplying(true);
        void global.Actual.applyAppUpdate();
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        marginBottom: 16,
        padding: '14px 16px',
        borderRadius: 18,
        backgroundColor: `${accent}1f`,
        border: `1px solid ${accent}44`,
        color: theme.pageText,
        font: 'inherit',
        fontSize: 15,
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <RefreshCw size={18} color={accent} />
      <span style={{ flex: 1 }}>
        {applying ? 'Mise à jour…' : 'Une nouvelle version est disponible'}
      </span>
      {!applying && (
        <span style={{ color: accent, fontWeight: 600 }}>Mettre à jour</span>
      )}
    </button>
  );
}

// Each screen starts at the top, not where the previous one was scrolled to.
function ScrollArea({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
  }, [pathname]);
  return (
    <div
      ref={ref}
      style={{
        flex: 1,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Keeps long screens at their full height instead of squeezing them to the viewport. */}
      <div
        style={{
          flexGrow: 1,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function HomeApp() {
  const mode = useLayoutMode();
  const frame = {
    height: '100%',
    backgroundColor: theme.pageBackground,
    color: theme.pageText,
  };

  if (mode === 'phone') {
    return (
      <View style={frame}>
        <ScrollArea>
          <View
            style={{
              width: '100%',
              maxWidth: 520,
              margin: '0 auto',
              padding: '24px 16px 120px',
              flexShrink: 0,
            }}
          >
            <UpdateBanner />
            <Screens />
          </View>
        </ScrollArea>
        <BottomBar />
      </View>
    );
  }

  return (
    <View style={{ ...frame, flexDirection: 'row' }}>
      <SideBar compact={mode === 'tablet'} />
      <ScrollArea>
        <View
          style={{
            width: '100%',
            maxWidth: 1200,
            flexShrink: 0,
            margin: '0 auto',
            padding: mode === 'desktop' ? '40px 48px' : '32px 28px',
          }}
        >
          <UpdateBanner />
          <Screens />
        </View>
      </ScrollArea>
    </View>
  );
}
