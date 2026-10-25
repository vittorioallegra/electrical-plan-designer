import type { CableColor } from '@epd/domain/types';

/** Swatch colors for conductor insulation. Always shown with role + color name too. */
export const cableSwatch: Record<CableColor, string> = {
  brown: '#7c4a21',
  blue: '#1d4ed8',
  yellow_green: 'linear-gradient(135deg, #facc15 0 50%, #16a34a 50% 100%)',
  black: '#111827',
  grey: '#9ca3af',
  red: '#dc2626',
  white: '#f9fafb',
  orange: '#f97316',
  violet: '#7c3aed',
  pink: '#ec4899',
};
