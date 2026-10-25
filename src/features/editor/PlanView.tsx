import { useTranslation } from 'react-i18next';
import { FloorsPanel } from './FloorsPanel';

/** Plan view frame: floor tabs + tools on the left, canvas, inspector on the right. */
export function PlanView() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full">
      <aside
        className="w-52 overflow-y-auto border-r border-border p-2"
        aria-label={t('editor.tools')}
      >
        <h1 className="sr-only">{t('pages.plan')}</h1>
        <FloorsPanel />
      </aside>
      <div className="flex-1 bg-canvas-bg" data-testid="canvas-area" />
      <aside className="w-64 border-l border-border p-2" aria-label={t('editor.inspector')}>
        <p className="text-text-muted">{t('editor.empty.selection')}</p>
      </aside>
    </div>
  );
}
