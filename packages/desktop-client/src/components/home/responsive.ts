import { useResponsive } from '@actual-app/components/hooks/useResponsive';

export type LayoutMode = 'phone' | 'tablet' | 'desktop';

export function useLayoutMode(): LayoutMode {
  const { atLeastMediumWidth, isWideWidth } = useResponsive();
  if (isWideWidth) return 'desktop';
  return atLeastMediumWidth ? 'tablet' : 'phone';
}

export function columns(mode: LayoutMode, template: string) {
  return mode === 'phone'
    ? { display: 'flex', flexDirection: 'column' as const, gap: 16 }
    : {
        display: 'grid',
        gridTemplateColumns: template,
        gap: 20,
        alignItems: 'start',
      };
}
