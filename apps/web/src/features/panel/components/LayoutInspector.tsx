import { useTranslation } from 'react-i18next';
import { suggestEnclosure, totalModules } from '@epd/domain/panel';
import type { Panel } from '@epd/domain/types';
import { useCatalog } from '@/api/catalog';
import { Button } from '@/components/ui/Button';
import { NumberInput } from '@/components/ui/NumberInput';
import { setEnclosure, setLayout } from '@/features/panel/utils/commands';
import { useItemName } from '@/hooks/useItemName';
import { useItemsOf } from '@/hooks/useItemsOf';
import { cn } from '@/lib/cn';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';

/** Enclosure, rails and modules per rail, with the used/available totals. */
export function LayoutInspector({ panel }: { panel: Panel }) {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const readOnly = useEditor((s) => s.readOnly);
  const { lookup } = useCatalog();
  const itemName = useItemName();
  const enclosures = useItemsOf('enclosure');
  const used = totalModules(panel, lookup);
  const capacity = panel.dinRails * panel.modulesPerRail;
  const suggestion = suggestEnclosure(used, enclosures);
  return (
    <div className="flex flex-col gap-2" data-testid="panel-layout">
      <h2 className="font-medium">{t('panel.layout')}</h2>
      <p
        className={cn('tabular-nums', used > capacity && 'font-medium text-error')}
        data-testid="panel-totals"
      >
        {t('panel.totals', { used, capacity })}
      </p>
      <label className="flex flex-col gap-1">
        {t('panel.enclosure')}
        <select
          className="h-[var(--control-height)] rounded border border-border px-2"
          value={panel.enclosureItemId ?? ''}
          disabled={readOnly}
          onChange={(e) => setEnclosure(store, lookup(e.target.value))}
        >
          <option value="">{t('panel.noEnclosure')}</option>
          {enclosures.map((e) => (
            <option key={e.id} value={e.id}>
              {itemName(e)}
            </option>
          ))}
        </select>
      </label>
      {suggestion && suggestion.id !== panel.enclosureItemId ? (
        <div className="flex items-center gap-2 rounded bg-surface-muted p-2">
          <span className="flex-1">{t('panel.suggested', { name: itemName(suggestion) })}</span>
          <Button disabled={readOnly} onClick={() => setEnclosure(store, suggestion)}>
            {t('panel.useSuggestion')}
          </Button>
        </div>
      ) : null}
      <label className="flex flex-col gap-1">
        {t('panel.rails')}
        <NumberInput
          aria-label={t('panel.rails')}
          decimals={0}
          value={panel.dinRails}
          min={1}
          max={12}
          disabled={readOnly}
          onValueChange={(v) => setLayout(store, { dinRails: Math.round(v) })}
        />
      </label>
      <label className="flex flex-col gap-1">
        {t('panel.modulesPerRail')}
        <NumberInput
          aria-label={t('panel.modulesPerRail')}
          decimals={0}
          value={panel.modulesPerRail}
          min={1}
          max={72}
          disabled={readOnly}
          onValueChange={(v) => setLayout(store, { modulesPerRail: Math.round(v) })}
        />
      </label>
      <p className="text-text-muted">{t('panel.hint')}</p>
    </div>
  );
}
