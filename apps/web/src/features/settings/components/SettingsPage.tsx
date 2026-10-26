import { useTranslation } from 'react-i18next';
import { ProjectSettingsForm } from '@/components/settings/ProjectSettingsForm';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';

/** Per-project settings; every change is an undoable command. */
export function SettingsPage() {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const settings = useEditor((s) => s.data.settings);
  const readOnly = useEditor((s) => s.readOnly);
  return (
    <div className="mx-auto max-w-xl overflow-y-auto p-4">
      <h1 className="mb-1 text-xl font-semibold">{t('pages.settings')}</h1>
      <p className="mb-4 text-text-muted">{t('settings.hint')}</p>
      <ProjectSettingsForm
        settings={settings}
        readOnly={readOnly}
        edit={(label, fn) => store.getState().applyCommand(label, (d) => fn(d.settings))}
      />
    </div>
  );
}
