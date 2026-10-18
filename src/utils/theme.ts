import { CorporateColorsConfig } from '../types';

export const DEFAULT_CORPORATE_COLORS: Required<CorporateColorsConfig> = {
  primaryColor: '#06b6d4', // Cyan
  secondaryColor: '#2563eb', // Blue
  companyBrandName: 'FDIM Suite',
  themeMode: 'dark-cyan',
  customCssVarEnabled: true,
};

export const COLOR_PRESETS = [
  { name: 'Cyber Cyan', primary: '#06b6d4', secondary: '#2563eb', description: 'Default high-tech sysadmin theme' },
  { name: 'Enterprise Blue', primary: '#0284c7', secondary: '#4f46e5', description: 'Corporate Microsoft 365 style' },
  { name: 'MSP Emerald', primary: '#10b981', secondary: '#059669', description: 'Clean IT service provider green' },
  { name: 'Royal Indigo', primary: '#6366f1', secondary: '#8b5cf6', description: 'Modern developer & cloud portal' },
  { name: 'Executive Purple', primary: '#8b5cf6', secondary: '#ec4899', description: 'Bold luxury executive theme' },
  { name: 'Amber Glow', primary: '#f59e0b', secondary: '#d97706', description: 'Warm industrial technician style' },
  { name: 'Crimson Ops', primary: '#ef4444', secondary: '#dc2626', description: 'Urgent NOC & operations center' },
  { name: 'Titanium Slate', primary: '#64748b', secondary: '#0ea5e9', description: 'Minimalist stealth enterprise' },
];

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return `${r}, ${g}, ${b}`;
  }
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `${r}, ${g}, ${b}`;
  }
  return '6, 182, 212';
}

export function applyCorporateTheme(colors?: CorporateColorsConfig): void {
  if (typeof document === 'undefined') return;

  const primary: string = colors?.primaryColor || DEFAULT_CORPORATE_COLORS.primaryColor;
  const secondary: string = colors?.secondaryColor || DEFAULT_CORPORATE_COLORS.secondaryColor;
  const root = document.documentElement;

  root.style.setProperty('--brand-primary', primary);
  root.style.setProperty('--brand-secondary', secondary);
  root.style.setProperty('--brand-primary-rgb', hexToRgb(primary));
  root.style.setProperty('--brand-secondary-rgb', hexToRgb(secondary));

  // Save in local storage for instantaneous hydration before next network fetch
  try {
    localStorage.setItem('fdim_corporate_colors', JSON.stringify({ primaryColor: primary, secondaryColor: secondary }));
  } catch {
    // Ignore localStorage errors
  }
}

export function loadSavedCorporateColors(): CorporateColorsConfig {
  if (typeof window === 'undefined') return DEFAULT_CORPORATE_COLORS;
  try {
    const saved = localStorage.getItem('fdim_corporate_colors');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...DEFAULT_CORPORATE_COLORS,
        ...parsed,
      };
    }
  } catch {
    // fallback
  }
  return DEFAULT_CORPORATE_COLORS;
}
