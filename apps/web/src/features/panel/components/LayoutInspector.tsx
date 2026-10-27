import { useTranslation } from 'react-i18next';
import { suggestEnclosure, totalModules } from '@epd/domain/panel';
import type { Panel } from '@epd/domain/types';
import { useCatalog } from '@/hooks/useCatalog';
import { Button } from '@/components/ui/Button';
import { NumberInput } from '@/components/ui/NumberInput';
import { PanelSection } from '@/components/ui/PanelSection';
import { Select } from '@/components/ui/Select';
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
    <div data-testid="panel-layout">
      <PanelSection title={t('panel.layout')}>
        <div className="flex flex-col gap-2">
          <p
            className={cn('font-mono tabular-nums', used > capacity && 'font-medium text-error')}
            data-testid="panel-totals"
          >
            {t('panel.totals', { used, capacity })}
          </p>
          <label className="flex flex-col gap-1 text-small text-text-muted">
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
          <label className="flex flex-col gap-1 text-small text-text-muted">
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
          <p className="text-small text-text-muted">{t('panel.hint')}</p>
        </div>
      </PanelSection>
      <PanelSection title={t('panel.enclosure')}>
        <div className="flex flex-col gap-2">
          <Select
            aria-label={t('panel.enclosure')}
            value={panel.enclosureItemId ?? ''}
            disabled={readOnly}
            onValueChange={(v) => setEnclosure(store, lookup(v))}
            options={[
              { value: '', label: t('panel.noEnclosure') },
              ...enclosures.map((e) => ({ value: e.id, label: itemName(e) })),
            ]}
          />
          {suggestion && suggestion.id !== panel.enclosureItemId ? (
            <div className="flex items-center gap-2 rounded-sm bg-accent-subtle p-2 text-accent-text">
              <span className="min-w-0 flex-1">
                {t('panel.suggested', { name: itemName(suggestion) })}
              </span>
              <Button disabled={readOnly} onClick={() => setEnclosure(store, suggestion)}>
                {t('panel.useSuggestion')}
              </Button>
            </div>
          ) : null}
        </div>
      </PanelSection>
    </div>
  );
}
