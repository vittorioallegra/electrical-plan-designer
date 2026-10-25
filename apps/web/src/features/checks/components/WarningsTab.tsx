import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { connectivityCheckIds, type Warning } from '@epd/domain/checks';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import { useAnalysis } from '@/hooks/useAnalysis';
import { checkOrder, describeWarning } from '@/lib/describeChecks';
import { focusElement } from '@/features/checks/utils/focus';

/** Warnings after the "hide connectivity" filter, shared by the tab and its badge. */
export function useVisibleWarnings(): { visible: Warning[]; hidden: number } {
  const { warnings } = useAnalysis();
  const hide = useEditor((s) => s.ui.hideConnectivity);
  return useMemo(() => {
    const visible = hide ? warnings.filter((w) => !connectivityCheckIds.has(w.id)) : warnings;
    return { visible, hidden: warnings.length - visible.length };
  }, [warnings, hide]);
}

export function WarningsTab() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'it' ? 'it' : 'en';
  const { store } = useEditorContext();
  const doc = useEditor((s) => s.data.doc);
  const projectId = useEditor((s) => s.projectId);
  const hide = useEditor((s) => s.ui.hideConnectivity);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { visible, hidden } = useVisibleWarnings();
  const groups = checkOrder
    .map((id) => [id, visible.filter((w) => w.id === id)] as const)
    .filter(([, list]) => list.length > 0);

  function open(w: Warning) {
    const target = `/projects/${projectId}/${focusElement(store, w.elementRef)}`;
    if (pathname !== target) void navigate(target);
  }

  return (
    <div className="flex flex-col gap-2" data-testid="warnings">
      <label className="flex items-center gap-1.5 text-text-muted">
        <input
          type="checkbox"
          checked={hide}
          onChange={(e) => store.getState().setUi({ hideConnectivity: e.target.checked })}
        />
        {t('checks.hideConnectivity')}
        {hidden > 0 ? <span>({t('checks.hiddenCount', { count: hidden })})</span> : null}
      </label>
      {groups.length === 0 ? <p className="text-text-muted">{t('editor.empty.warnings')}</p> : null}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-x-6 gap-y-2">
        {groups.map(([id, list]) => (
          <section key={id} aria-label={t(`checks.titles.${id}`)}>
            <h3 className="mb-0.5 font-medium">
              {t(`checks.titles.${id}`)}{' '}
              <span className="font-normal text-text-muted tabular-nums">{list.length}</span>
            </h3>
            <ul>
              {list.map((w, i) => (
                <li key={`${w.elementRef.id}-${i}`}>
                  <button
                    className="w-full rounded px-1 py-0.5 text-left hover:bg-surface-muted"
                    onClick={() => open(w)}
                  >
                    {describeWarning(w, doc, t, locale)}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

/** Calm count badge for the Warnings tab label. */
export function WarningsBadge() {
  const { visible } = useVisibleWarnings();
  if (visible.length === 0) return null;
  return (
    <span
      className="ml-1.5 rounded-full bg-surface-muted px-1.5 text-text-muted tabular-nums"
      data-testid="warnings-badge"
    >
      {visible.length}
    </span>
  );
}
