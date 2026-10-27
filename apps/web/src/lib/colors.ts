import type { CableColor } from '@epd/domain/types';

/**
 * Swatch colors for conductor insulation, as CSS color values reading the `--color-conductor-*`
 * tokens. Yellow-green is the one two-tone color: use `yellowGreenGradient` for it.
 * Always shown with role + color name too.
 */
export const cableSwatch: Record<Exclude<CableColor, 'yellow_green'>, string> = {
  brown: 'var(--color-conductor-brown)',
  blue: 'var(--color-conductor-blue)',
  black: 'var(--color-conductor-black)',
  grey: 'var(--color-conductor-grey)',
  red: 'var(--color-conductor-red)',
  white: 'var(--color-conductor-white)',
  orange: 'var(--color-conductor-orange)',
  violet: 'var(--color-conductor-violet)',
  pink: 'var(--color-conductor-pink)',
};

export const yellowGreenGradient =
  'linear-gradient(135deg, var(--color-conductor-yellow) 0 50%, var(--color-conductor-green) 50% 100%)';

/** CSS `background` value of a conductor color's swatch. */
export function cableSwatchBackground(color: CableColor): string {
  return color === 'yellow_green' ? yellowGreenGradient : cableSwatch[color];
}
