/**
 * Design-token source of truth — all values from DESIGN.md.
 * Components MUST consume these; never reference inline hex or magic numbers.
 */
import type { TextStyle } from 'react-native';

// ---------------------------------------------------------------------------
// Color palettes
// ---------------------------------------------------------------------------

export type ColorTokens = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  success: string;
  warning: string;
  danger: string;
  focusRing: string;
  overlay: string;
};

export const lightColors: ColorTokens = {
  bg: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF0F4',
  border: '#E1E4EA',
  textPrimary: '#14171F',
  textSecondary: '#586173',
  textMuted: '#8A93A2',
  primary: '#3B5BDB',
  primaryPressed: '#2F49B0',
  onPrimary: '#FFFFFF',
  success: '#2F9E44',
  warning: '#E8920C',
  danger: '#E03131',
  focusRing: 'rgba(59,91,219,0.35)',   // primary @ 35%
  overlay: 'rgba(14,16,20,0.45)',       // #0E1014 @ 45%
};

export const darkColors: ColorTokens = {
  bg: '#0E1014',
  surface: '#161A21',
  surfaceAlt: '#1E232C',
  border: '#2A313C',
  textPrimary: '#ECEFF4',
  textSecondary: '#A6AFBD',
  textMuted: '#6B7480',
  primary: '#5C7CFA',
  primaryPressed: '#4263EB',
  onPrimary: '#0B0D11',
  success: '#51CF66',
  warning: '#FCC419',
  danger: '#FF6B6B',
  focusRing: 'rgba(92,124,250,0.45)',   // primary @ 45%
  overlay: 'rgba(0,0,0,0.55)',           // #000000 @ 55%
};

// ---------------------------------------------------------------------------
// Spacing — 4pt grid
// ---------------------------------------------------------------------------

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

export type SpacingScale = typeof spacing;

// ---------------------------------------------------------------------------
// Radii
// ---------------------------------------------------------------------------

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export type RadiiScale = typeof radii;

// ---------------------------------------------------------------------------
// Typography — system font stack (San Francisco / Roboto)
// ---------------------------------------------------------------------------

export type TypeStyle = {
  fontSize: number;
  fontWeight: '400' | '500' | '600' | '700';
  lineHeight: number;
  letterSpacing: number;
  fontFamily?: string;
  fontVariant?: TextStyle['fontVariant'];
};

export type TypeScale = {
  display: TypeStyle;
  title: TypeStyle;
  heading: TypeStyle;
  body: TypeStyle;
  bodyStrong: TypeStyle;
  subhead: TypeStyle;
  caption: TypeStyle;
  mono: TypeStyle;
};

export const type: TypeScale = {
  display: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 38,
    letterSpacing: -0.3,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  heading: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
    letterSpacing: 0,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    letterSpacing: 0,
  },
  bodyStrong: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    letterSpacing: 0,
  },
  subhead: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    letterSpacing: 0,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    letterSpacing: 0,
  },
  mono: {
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 24,
    letterSpacing: 1,
    fontFamily: 'Menlo',
    fontVariant: ['tabular-nums' as const],
  },
} as const;
