import type { TFunction } from 'i18next';
import type { CheckId, Warning } from '@epd/domain/checks';
import type { ProjectDoc } from '@epd/domain/types';
import { formatNumber, type Locale } from '@/ui/format';

/** Display order of the warning groups: electrical safety first, data quality last. */
export const checkOrder: CheckId[] = [
  'no_rcd',
  'rating_section',
  'section_type',
  'conduit_fill',
  'panel_capacity',
  'box_modules',
  'route_invalid',
  'target_unreachable',
  'box_not_reached',
  'not_connected',
  'box_empty',
  'riser_mixed_elevation',
  'height_clamped',
  'missing_item',
];

/** Name of the element a warning points at, for warnings whose params carry none. */
function elementName(w: Warning, doc: ProjectDoc, t: TFunction): string {
  const ref = w.elementRef;
  if (ref.kind === 'node') return doc.nodes.find((n) => n.id === ref.id)?.label || ref.id;
  if (ref.kind === 'segment') return t('checks.segment');
  if (ref.kind === 'extra_run') return t('circuits.extraRun');
  if (ref.kind === 'circuit') return doc.circuits.find((c) => c.id === ref.id)?.name ?? ref.id;
  const device = doc.panels.flatMap((p) => p.devices).find((d) => d.id === ref.id);
  return device?.label || ref.id;
}

/** One-line message of a warning in the UI language. */
export function describeWarning(w: Warning, doc: ProjectDoc, t: TFunction, locale: Locale): string {
  const p = w.params;
  const num = (v: string | number | undefined) =>
    typeof v === 'number' ? formatNumber(v, locale) : (v ?? '');
  const name = String(p.name ?? p.label ?? elementName(w, doc, t));
  switch (w.id) {
    case 'section_type':
      return t('checks.messages.section_type', {
        name,
        section: num(p.section),
        min: num(p.min),
        type: t(`circuits.types.${String(p.type)}`),
      });
    case 'rating_section':
      return t('checks.messages.rating_section', {
        name,
        rating: num(p.rating),
        section: num(p.section),
        max: num(p.max),
      });
    case 'conduit_fill':
      return t('checks.messages.conduit_fill', {
        conductors: p.conductors,
        inner: num(p.inner),
        required: num(p.required),
      });
    case 'box_modules':
      return t('checks.messages.box_modules', { name, used: p.used, available: p.available });
    case 'panel_capacity':
      return t(`checks.messages.panel_${String(p.reason)}`, { name });
    case 'route_invalid':
      return t('checks.messages.route_invalid', {
        name,
        problem: t(`circuits.problems.${String(p.problem)}`),
      });
    case 'target_unreachable':
      return t('checks.messages.target_unreachable', { name, count: p.count });
    case 'missing_item':
      return t('checks.messages.missing_item', { name, id: p.itemId });
    default:
      return t(`checks.messages.${w.id}`, { name });
  }
}
