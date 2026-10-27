import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { connectivityCheckIds, type Warning } from '@epd/domain/checks';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Table } from '@/components/ui/Table';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import { useAnalysis } from '@/hooks/useAnalysis';
import { checkOrder, describeWarning, warningLocation } from '@/lib/describeChecks';
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
  const hide = useEditor((s) => s.ui.hideConnectivity);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { visible, hidden } = useVisibleWarnings();
  // Grouped by check in display order, so the table reads as the former groups did.
  const rows = checkOrder.flatMap((id) => visible.filter((w) => w.id === id));

  function open(w: Warning) {
    const target = `/project/${focusElement(store, w.elementRef)}`;
    if (pathname !== target) void navigate(target);
  }

  return (
    <div className="flex flex-col" data-testid="warnings">
      <label className="flex h-9 items-center gap-2 text-text-muted">
        <input
          type="checkbox"
          className="accent-accent"
          checked={hide}
          onChange={(e) => store.getState().setUi({ hideConnectivity: e.target.checked })}
        />
        {t('checks.hideConnectivity')}
        {hidden > 0 ? <span>({t('checks.hiddenCount', { count: hidden })})</span> : null}
      </label>
      {rows.length === 0 ? (
        <EmptyState message={t('editor.empty.warnings')} />
      ) : (
        <Table<Warning>
          rowKey={(w) => `${w.id}:${w.elementRef.id}:${rows.indexOf(w)}`}
          rows={rows}
          onRowClick={open}
          columns={[
            {
              key: 'severity',
              header: t('checks.columns.severity'),
              cell: (w) => <Badge tone="warning">{t(`checks.severity.${w.severity}`)}</Badge>,
            },
            {
              key: 'check',
              header: t('checks.columns.check'),
              cell: (w) => <span className="text-text-muted">{t(`checks.titles.${w.id}`)}</span>,
            },
            {
              key: 'message',
              header: t('checks.columns.message'),
              cell: (w) => describeWarning(w, doc, t, locale),
            },
            {
              key: 'location',
              header: t('checks.columns.location'),
              cell: (w) => <span className="text-text-muted">{warningLocation(w, doc, t)}</span>,
            },
          ]}
        />
      )}
    </div>
  );
}

/** Calm count badge for the Warnings tab label. */
export function WarningsBadge() {
  const { visible } = useVisibleWarnings();
  if (visible.length === 0) return null;
  return (
    <Badge className="ml-1.5 font-mono tabular-nums">
      <span data-testid="warnings-badge">{visible.length}</span>
    </Badge>
  );
}
