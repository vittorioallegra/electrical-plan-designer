import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { useEditorServices } from '@/stores/editor/EditorContext';
import { useLibrary } from '@/stores/library/useLibrary';

/**
 * Tells the user when the library started with defaults because a file was invalid (it was set
 * aside, not deleted), and when a library change could not be written.
 */
export function LibraryNotices() {
  const { t } = useTranslation();
  const { library } = useEditorServices();
  const invalid = useLibrary((s) => s.invalid);
  const writeError = useLibrary((s) => s.writeError);
  if (invalid.length === 0 && !writeError) return null;
  return (
    <div className="flex flex-col">
      {invalid.length > 0 ? (
        <div
          role="status"
          className="flex items-center gap-3 bg-warning-bg px-3 py-1.5 text-warning"
        >
          <span className="flex-1">
            {t('library.invalidNotice', { files: invalid.join(', ') })}
          </span>
          <Button variant="ghost" onClick={() => library.getState().dismissInvalid()}>
            {t('library.dismiss')}
          </Button>
        </div>
      ) : null}
      {writeError ? (
        <div
          role="alert"
          className="flex items-center gap-3 bg-warning-bg px-3 py-1.5 text-warning"
        >
          <span className="flex-1">{t('library.writeFailed', { message: writeError })}</span>
          <Button variant="ghost" onClick={() => library.getState().dismissWriteError()}>
            {t('library.dismiss')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
