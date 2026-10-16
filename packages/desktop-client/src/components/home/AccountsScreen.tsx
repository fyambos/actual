import React, { useState } from 'react';
import { Link } from 'react-router';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import {
  ChevronRight,
  Inbox,
  Landmark,
  List,
  PiggyBank,
  RefreshCw,
  Settings,
} from 'lucide-react';

import { useAccountBalances } from '#hooks/useAccountBalances';
import { useAccounts } from '#hooks/useAccounts';

import { accent, radius } from './design';
import { useInboxCounts } from './InboxScreen';
import { Card, ScreenHeader, SectionTitle } from './layout';
import { columns, useLayoutMode } from './responsive';
import { formatAmount } from './spending';

const relative = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' });

function syncedAgo(lastSync: string | null) {
  if (!lastSync) return null;
  const minutes = Math.round((Number(lastSync) - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, 'hour');
  return relative.format(Math.round(hours / 24), 'day');
}

function ShortcutRow({
  to,
  icon: Icon,
  count,
  children,
}: {
  to: string;
  icon: typeof List;
  count?: number;
  children: string;
}) {
  return (
    <Link
      to={to}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        color: theme.pageText,
        textDecoration: 'none',
        fontSize: 15,
      }}
    >
      <Icon size={20} color={accent} />
      <span style={{ flex: 1 }}>{children}</span>
      {count != null && (
        <span
          style={{
            minWidth: 22,
            padding: '2px 8px',
            borderRadius: radius.pill,
            backgroundColor: accent,
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            textAlign: 'center',
          }}
        >
          {count}
        </span>
      )}
      <ChevronRight size={18} color={theme.pageTextSubdued} />
    </Link>
  );
}

export function AccountsScreen() {
  const inbox = useInboxCounts();
  const { data: accounts } = useAccounts();
  const mode = useLayoutMode();
  const open = (accounts ?? []).filter(a => !a.closed);
  const balances = useAccountBalances(open.map(a => a.id));
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const linked = open.filter(a => a.account_sync_source);
  const total = open.reduce((sum, a) => sum + (balances[a.id] ?? 0), 0);

  async function syncAll() {
    setSyncing(true);
    setMessage(null);
    try {
      await send('accounts-bank-sync', { ids: linked.map(a => a.id) });
      setMessage('Comptes à jour');
    } catch {
      setMessage("La synchronisation n'a pas abouti");
    } finally {
      setSyncing(false);
    }
  }

  const groups: Array<[string, typeof open]> = [
    ['Comptes courants', open.filter(a => !a.offbudget)],
    ['Épargne', open.filter(a => a.offbudget)],
  ];

  return (
    <View style={{ gap: 16 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        <ScreenHeader overline="Tout ton argent" title="Comptes" />
        <Link
          to="/home/settings"
          aria-label="Réglages"
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.pill,
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            color: theme.pageText,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Settings size={20} />
        </Link>
      </View>

      <View style={{ gap: 8 }}>
        <ShortcutRow to="/home/transactions" icon={List}>
          Toutes les opérations
        </ShortcutRow>
        {inbox.total > 0 && (
          <ShortcutRow to="/home/inbox" icon={Inbox} count={inbox.total}>
            À traiter
          </ShortcutRow>
        )}
      </View>

      <View style={columns(mode, mode === 'desktop' ? '380px 1fr' : '1fr')}>
        <Card style={{ gap: 14 }}>
          <Text style={{ fontSize: 14, color: theme.pageTextSubdued }}>
            Total
          </Text>
          <Text style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1.2 }}>
            {formatAmount(total)}
          </Text>
          {linked.length > 0 && (
            <button
              type="button"
              disabled={syncing}
              onClick={() => void syncAll()}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                height: 48,
                border: 'none',
                borderRadius: 16,
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                color: theme.pageText,
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <RefreshCw
                size={18}
                color={accent}
                style={{
                  animation: syncing ? 'spin 1s linear infinite' : undefined,
                }}
              />
              {syncing ? 'Synchronisation…' : 'Synchroniser maintenant'}
            </button>
          )}
          {message && (
            <Text
              style={{
                fontSize: 14,
                color: theme.pageTextSubdued,
                textAlign: 'center',
              }}
            >
              {message}
            </Text>
          )}
        </Card>

        <View style={{ gap: 20 }}>
          {groups
            .filter(([, list]) => list.length > 0)
            .map(([label, list]) => (
              <View key={label} style={{ gap: 10 }}>
                <SectionTitle>{label}</SectionTitle>
                <Card style={{ padding: 6 }}>
                  {list.map(account => {
                    const Icon = account.offbudget ? PiggyBank : Landmark;
                    const ago = syncedAgo(account.last_sync);
                    return (
                      <Link
                        key={account.id}
                        to={`/home/transactions?account=${account.id}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '12px',
                          borderRadius: 16,
                          color: theme.pageText,
                          textDecoration: 'none',
                        }}
                      >
                        <View
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: radius.tile,
                            backgroundColor: `${accent}22`,
                            color: accent,
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Icon size={20} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                          <Text style={{ fontSize: 16, fontWeight: 500 }}>
                            {account.name}
                          </Text>
                          <Text
                            style={{
                              fontSize: 13,
                              color: theme.pageTextSubdued,
                            }}
                          >
                            {account.account_sync_source
                              ? ago
                                ? `Synchronisé ${ago}`
                                : 'Synchronisé'
                              : 'Mis à jour à la main'}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 16, fontWeight: 600 }}>
                          {balances[account.id] == null
                            ? '…'
                            : formatAmount(balances[account.id]!)}
                        </Text>
                        <ChevronRight size={18} color={theme.pageTextSubdued} />
                      </Link>
                    );
                  })}
                </Card>
              </View>
            ))}
        </View>
      </View>
    </View>
  );
}
