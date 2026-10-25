// Conduit fill: circumscribed diameter of a conductor bundle. A warning aid, not a certification.

/**
 * Ratio of the smallest enclosing circle to the circle diameter for n equal circles
 * (best known packings, n = 1–20).
 */
const packingRatio = [
  1, 2, 2.1547, 2.4142, 2.7013, 3, 3, 3.3048, 3.6131, 3.813, 3.9238, 4.0296, 4.2361, 4.3284, 4.5214,
  4.6154, 4.792, 4.8637, 4.8637, 5.1223,
];

/** Packing density used for the area approximation above 20 conductors. */
const LARGE_BUNDLE_DENSITY = 0.77;

/**
 * Circumscribed bundle Ø (mm). Mixed sizes use the largest outer Ø as d (conservative).
 * Above 20 conductors: d × √(n / 0.77).
 */
export function bundleDiameter(outerDiameters: readonly number[]): number {
  const n = outerDiameters.length;
  if (n === 0) return 0;
  const d = Math.max(...outerDiameters);
  const ratio =
    n <= packingRatio.length ? packingRatio[n - 1]! : Math.sqrt(n / LARGE_BUNDLE_DENSITY);
  return ratio * d;
}

/** Fill check: the conduit inner Ø must be ≥ factor × bundle Ø. */
export function conduitTooSmall(
  innerDiameter: number,
  bundleDiameterMm: number,
  factor: number,
): boolean {
  return bundleDiameterMm > 0 && innerDiameter < factor * bundleDiameterMm;
}

/** Outer Ø of a single-core cable of the given section when the catalog has none. */
export function estimatedOuterDiameter(crossSection: number): number {
  return 2 * Math.sqrt(crossSection / Math.PI) + 1.6;
}
