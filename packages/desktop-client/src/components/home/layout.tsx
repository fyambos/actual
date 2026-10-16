import React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { ChevronLeft, X } from 'lucide-react';

import { categoryLook, hairline, radius } from './design';

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <View
      style={{
        backgroundColor: theme.cardBackground,
        border: hairline,
        borderRadius: radius.card,
        flexShrink: 0,
        padding: 20,
        ...style,
      }}
    >
      {children}
    </View>
  );
}

export function ScreenHeader({
  overline,
  title,
  back,
}: {
  overline?: string;
  title: string;
  // Where the back link of a secondary page leads.
  back?: { to: string; label: string };
}) {
  return (
    <View style={{ gap: 4, padding: '4px 4px 0', minWidth: 0 }}>
      {back && (
        <Link
          to={back.to}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            marginLeft: -6,
            marginBottom: 6,
            color: theme.pageTextSubdued,
            textDecoration: 'none',
            fontSize: 15,
          }}
        >
          <ChevronLeft size={20} />
          {back.label}
        </Link>
      )}
      {overline && (
        <Text style={{ color: theme.pageTextSubdued, fontSize: 14 }}>
          {overline}
        </Text>
      )}
      <Text style={{ fontSize: 32, fontWeight: 700, letterSpacing: -0.8 }}>
        {title}
      </Text>
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        fontSize: 15,
        fontWeight: 600,
        color: theme.pageTextSubdued,
        padding: '8px 4px 0',
      }}
    >
      {children}
    </Text>
  );
}

export function CategoryTile({
  name,
  size = 42,
}: {
  name: string | null | undefined;
  size?: number;
}) {
  const { icon: Icon, color } = categoryLook(name);
  return (
    <View
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: radius.tile,
        backgroundColor: `${color}22`,
        color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon size={size * 0.48} strokeWidth={2} />
    </View>
  );
}

export const fieldStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  backgroundColor: 'rgba(255, 255, 255, 0.04)',
  color: theme.pageText,
  borderRadius: 16,
  fontSize: 16,
  padding: '14px 16px',
  outline: 'none',
};

export function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        border: 'none',
        background: 'rgba(255, 255, 255, 0.06)',
        color: theme.pageText,
        width: 36,
        height: 36,
        flexShrink: 0,
        borderRadius: radius.pill,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.3 : 1,
      }}
    >
      {children}
    </button>
  );
}

// A bottom sheet on a phone, a centred dialog on wider screens.
export function Sheet({
  title,
  centered,
  onClose,
  children,
}: {
  title: string;
  centered: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <View
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(6px)',
        justifyContent: centered ? 'center' : 'flex-end',
        padding: centered ? 24 : 0,
      }}
    >
      <View
        role="dialog"
        aria-label={title}
        onClick={event => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: centered ? 520 : 560,
          maxHeight: centered ? '90vh' : '92vh',
          overflowY: 'auto',
          margin: '0 auto',
          backgroundColor: theme.cardBackground,
          borderRadius: centered ? 28 : '28px 28px 0 0',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderBottom: centered ? undefined : 'none',
          padding: centered
            ? '20px 24px 24px'
            : '12px 20px calc(24px + env(safe-area-inset-bottom))',
          gap: 18,
        }}
      >
        {!centered && (
          <View
            style={{
              width: 40,
              height: 4,
              flexShrink: 0,
              borderRadius: radius.pill,
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              alignSelf: 'center',
            }}
          />
        )}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: 600 }}>{title}</Text>
          <IconButton label="Fermer" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </View>
        {/* Views shrink by default; inside this capped, scrolling sheet they would overlap. */}
        <View style={{ gap: 18, flexShrink: 0 }}>{children}</View>
      </View>
    </View>
  );
}
