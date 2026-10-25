import { useTranslation } from 'react-i18next';
import type { CableColor } from '@epd/domain/types';
import { cableSwatch } from '@/ui/colors';

/** Swatch + role + color name (never color alone: color-blind safe). */
export function ConductorBadge({ role, color }: { role: string; color: CableColor }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <span
        aria-hidden
        className="inline-block h-3 w-3 rounded-sm border border-border"
        style={{ background: cableSwatch[color] }}
      />
      <span className="font-medium">{t(`conductorRoles.${role}`)}</span>
      <span className="text-text-muted">{t(`colors.${color}`)}</span>
    </span>
  );
}
