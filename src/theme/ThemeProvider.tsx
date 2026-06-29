import React, { createContext, useContext, type JSX } from 'react';
import { useColorScheme } from 'react-native';
import {
  lightColors,
  darkColors,
  spacing,
  radii,
  sizes,
  type as typeScale,
  type ColorTokens,
  type SpacingScale,
  type RadiiScale,
  type SizesScale,
  type TypeScale,
} from './tokens';

// ---------------------------------------------------------------------------
// Theme shape
// ---------------------------------------------------------------------------

export type Theme = {
  colors: ColorTokens;
  spacing: SpacingScale;
  radii: RadiiScale;
  sizes: SizesScale;
  type: TypeScale;
  isDark: boolean;
};

const lightTheme: Theme = {
  colors: lightColors,
  spacing,
  radii,
  sizes,
  type: typeScale,
  isDark: false,
};

const darkTheme: Theme = {
  colors: darkColors,
  spacing,
  radii,
  sizes,
  type: typeScale,
  isDark: true,
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ThemeContext = createContext<Theme>(lightTheme);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ThemeProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? darkTheme : lightTheme;
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
