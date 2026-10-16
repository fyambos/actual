import { theme } from '@actual-app/components/theme';
import type { LucideIcon } from 'lucide-react';
import {
  Bus,
  Gamepad2,
  HeartPulse,
  House,
  PiggyBank,
  Repeat,
  ShoppingBag,
  ShoppingBasket,
  Sparkles,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react';

export const radius = { card: 24, tile: 14, pill: 999 };

export const hairline = '1px solid rgba(255, 255, 255, 0.06)';

export const accent = theme.buttonPrimaryBackground;

const palette = [
  '#7c96ec',
  '#34c77b',
  '#f2a93b',
  '#ff7ab6',
  '#4da3ff',
  '#b38cff',
  '#2fc6c0',
  '#ff8a5c',
];

const iconRules: Array<[RegExp, LucideIcon]> = [
  [/course|food|aliment|supermarch|grocer/i, ShoppingBasket],
  [/resto|restaurant|livraison|eat|caf/i, UtensilsCrossed],
  [/transport|train|uber|velib|navigo|essence/i, Bus],
  [/shopping|v[êe]tement|mode|clothes/i, ShoppingBag],
  [/abonnement|subscription|bill/i, Repeat],
  [/sant[ée]|health|pharma|m[ée]decin/i, HeartPulse],
  [/logement|loyer|maison|home|rent/i, House],
  [/loisir|jeu|game|sortie|fun/i, Gamepad2],
  [/[ée]pargne|saving/i, PiggyBank],
  [/beaut[ée]|soin|beauty/i, Sparkles],
];

function hash(text: string) {
  let h = 0;
  for (const char of text) h = (h * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export function categoryLook(name: string | undefined | null) {
  const label = name ?? '';
  const icon =
    iconRules.find(([pattern]) => pattern.test(label))?.[1] ?? Wallet;
  const color = palette[hash(label) % palette.length];
  return { icon, color };
}
