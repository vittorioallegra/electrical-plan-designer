import { useTranslation } from 'react-i18next';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import { saveStatusOf } from '@/stores/editor/editorStore';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

export function SaveStatus() {
  const { t } = useTranslation();
  const { autosave } = useEditorContext();
  const status = useEditor(saveStatusOf);
  const failed = useEditor((s) => s.draftFailed);
  return (
    <span className="flex items-center gap-2" role="status" aria-live="polite">
      <span
        data-testid="save-status"
        data-status={status}
        title={t(`editor.saveStatus.${status}_hint`)}
        className={cn(failed ? 'text-error' : 'text-text-muted')}
      >
        {failed ? t('editor.saveStatus.draftFailed') : t(`editor.saveStatus.${status}`)}
      </span>
      {failed ? (
        <Button variant="ghost" onClick={() => autosave.flush()}>
          {t('editor.saveStatus.retry')}
        </Button>
      ) : null}
    </span>
  );
}
