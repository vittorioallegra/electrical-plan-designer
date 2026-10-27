import { useTranslation } from 'react-i18next';
import type { Routing } from '@epd/domain/types';
import { Button } from '@/components/ui/Button';
import { PanelSection } from '@/components/ui/PanelSection';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useShowPlan } from '@/features/circuits/hooks/useShowPlan';
import { setRoutingMode } from '@/features/circuits/utils/commands';
import { useAnalysis } from '@/hooks/useAnalysis';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import { RouteStatus } from './RouteStatus';

/** Auto/manual routing of a circuit or extra run, and picking its manual route on the plan. */
export function RoutingControls({
  owner,
  routing,
}: {
  owner: { kind: 'circuit' | 'extra'; id: string };
  routing: Routing;
}) {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const readOnly = useEditor((s) => s.readOnly);
  const pick = useEditor((s) => s.ui.pick);
  const analysis = useAnalysis();
  const route =
    owner.kind === 'circuit'
      ? analysis.routing.circuitRoutes.get(owner.id)
      : analysis.routing.extraRunRoutes.get(owner.id);
  const pickingRoute = pick?.mode === 'route' && pick.owner.id === owner.id;
  const showPlan = useShowPlan();
  return (
    <PanelSection title={t('circuits.routing')}>
      <div className="flex flex-col gap-2">
        <SegmentedControl
          aria-label={t('circuits.routing')}
          value={routing.mode}
          disabled={readOnly}
          onValueChange={(mode) => {
            setRoutingMode(store, owner, mode as 'auto' | 'manual', analysis.routing);
            if (mode === 'auto' && pickingRoute) store.getState().setUi({ pick: null });
          }}
          options={(['auto', 'manual'] as const).map((mode) => ({
            value: mode,
            label: t(`circuits.mode.${mode}`),
          }))}
        />
        {routing.mode === 'manual' ? (
          <Button
            variant={pickingRoute ? 'primary' : 'secondary'}
            disabled={readOnly}
            onClick={() => {
              if (!pickingRoute) showPlan();
              store.getState().setUi({
                pick: pickingRoute ? null : { mode: 'route', owner },
                activeOwner: owner,
                tool: 'select',
              });
            }}
          >
            {pickingRoute ? t('circuits.doneEditingRoute') : t('circuits.editRoute')}
          </Button>
        ) : null}
        <p data-testid="route-status">
          <RouteStatus route={route} />
        </p>
      </div>
    </PanelSection>
  );
}
