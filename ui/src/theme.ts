import { createContext, useContext } from 'react'

export interface Theme {
  bg: string
  surface: string
  border: string
  text: string
  text2: string
  text3: string
  brand: string
  brandBg: string
  danger: string
  warning: string
  success: string
  inputBg: string
  inputBorder: string
  isDark: boolean
}

export const DARK: Theme = {
  bg:          '#0D0C0B',
  surface:     '#161412',
  border:      '#262320',
  text:        '#ECE8E1',
  text2:       '#6E6A61',
  text3:       '#332F2A',
  brand:       '#9B6DFF',
  brandBg:     'rgba(155,109,255,0.10)',
  danger:      '#F87171',
  warning:     '#FBBF24',
  success:     '#4ADE80',
  inputBg:     '#0A0908',
  inputBorder: '#1F1D1A',
  isDark:      true,
}

export const LIGHT: Theme = {
  bg:          '#F2F0EC',
  surface:     '#FFFFFF',
  border:      '#E2DFD9',
  text:        '#1A1815',
  text2:       '#6E6A62',
  text3:       '#C0BCB4',
  brand:       '#7C3AED',
  brandBg:     'rgba(124,58,237,0.07)',
  danger:      '#DC2626',
  warning:     '#D97706',
  success:     '#16A34A',
  inputBg:     '#F8F6F2',
  inputBorder: '#E2DFD9',
  isDark:      false,
}

export const ThemeCtx = createContext<Theme>(DARK)
export const useTheme = () => useContext(ThemeCtx)
