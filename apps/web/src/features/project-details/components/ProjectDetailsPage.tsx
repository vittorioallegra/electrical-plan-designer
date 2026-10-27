import { useTranslation } from 'react-i18next';
import { ProjectSettingsForm } from '@/components/settings/ProjectSettingsForm';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';

/** Per-project settings; every change is an undoable command. */
export function ProjectDetailsPage() {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const settings = useEditor((s) => s.data.settings);
  const readOnly = useEditor((s) => s.readOnly);
  return (
    <div className="h-full overflow-y-auto bg-panel">
      <div className="flex max-w-xl flex-col gap-6 px-6 py-4">
        <header>
          <h1 className="text-heading font-semibold">{t('pages.projectDetails')}</h1>
          <p className="mt-0.5 text-text-muted">{t('settings.hint')}</p>
        </header>
        <ProjectSettingsForm
          settings={settings}
          readOnly={readOnly}
          edit={(label, fn) => store.getState().applyCommand(label, (d) => fn(d.settings))}
        />
      </div>
    </div>
  );
}
