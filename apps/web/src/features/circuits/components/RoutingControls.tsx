import { useTranslation } from 'react-i18next';
import type { Routing } from '@epd/domain/types';
import { Button } from '@/components/ui/Button';
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
    <fieldset className="flex flex-col gap-1">
      <legend className="font-medium">{t('circuits.routing')}</legend>
      <div className="flex gap-3">
        {(['auto', 'manual'] as const).map((mode) => (
          <label key={mode} className="flex items-center gap-1">
            <input
              type="radio"
              name={`routing-${owner.id}`}
              checked={routing.mode === mode}
              disabled={readOnly}
              onChange={() => {
                setRoutingMode(store, owner, mode, analysis.routing);
                if (mode === 'auto' && pickingRoute) store.getState().setUi({ pick: null });
              }}
            />
            {t(`circuits.mode.${mode}`)}
          </label>
        ))}
      </div>
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
    </fieldset>
  );
}
