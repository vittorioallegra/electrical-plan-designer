import { useTranslation } from 'react-i18next';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

export function SaveStatus() {
  const { t } = useTranslation();
  const { autosave } = useEditorContext();
  const status = useEditor((s) => s.saveStatus);
  const error = useEditor((s) => s.saveError);
  const label =
    status === 'error'
      ? t(`editor.saveStatus.error_${error ?? 'network'}`)
      : t(`editor.saveStatus.${status}`);
  return (
    <span className="flex items-center gap-2" role="status" aria-live="polite">
      <span
        data-testid="save-status"
        data-status={status}
        className={cn(
          status === 'error' || status === 'conflict' ? 'text-error' : 'text-text-muted',
        )}
      >
        {label}
      </span>
      {status === 'error' && (error === 'network' || error === 'invalid_doc') ? (
        <Button variant="ghost" onClick={() => autosave.flush()}>
          {t('editor.saveStatus.retry')}
        </Button>
      ) : null}
    </span>
  );
}
