import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { useFetchProjectRecord, useProjectSaved } from '@/api/projectRecord';
import { useRepositories } from '@/lib/repositories/provider';
import { DocLoadError, loadDoc } from '@epd/domain/load';
import { startAutosave, type Autosave } from '@/stores/editor/autosave';
import { EditorProvider, useEditorServices } from '@/stores/editor/EditorContext';
import { createEditorStore, type EditorStore } from '@/stores/editor/editorStore';
import { shouldOfferRestore, type UnsavedCopy } from '@/stores/editor/unsavedStore';
import { Button } from '@/components/ui/Button';
import { downloadJson } from '@/lib/download';

type LoadState =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'failed' }
  | { status: 'invalid'; error: DocLoadError; raw: unknown; name: string }
  | { status: 'ready'; store: EditorStore; autosave: Autosave; restore: UnsavedCopy | null };

declare global {
  interface Window {
    __epd?: { store: EditorStore };
  }
}

export interface ProjectFrameProps {
  restore: UnsavedCopy | null;
  onRestoreHandled: () => void;
}

/**
 * Loads and validates a project, then mounts the editor with its store and autosave.
 * The app supplies the frame (top bar, views, drawer), which composes several features.
 */
export function ProjectLoader({
  renderFrame,
}: {
  renderFrame: (props: ProjectFrameProps) => ReactNode;
}) {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const repos = useRepositories();
  const fetchRecord = useFetchProjectRecord();
  const onSaved = useProjectSaved();
  const { unsaved, exposeTestHandle } = useEditorServices();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | undefined;
    void (async () => {
      let record;
      try {
        record = await fetchRecord(id);
      } catch {
        if (active) setState({ status: 'failed' });
        return;
      }
      if (!active) return;
      if (!record) {
        setState({ status: 'not_found' });
        return;
      }
      let loaded;
      try {
        loaded = loadDoc(record.rawDoc);
      } catch (e) {
        if (!(e instanceof DocLoadError)) throw e;
        setState({ status: 'invalid', error: e, raw: record.rawDoc, name: record.meta.name });
        return;
      }
      const copy = await unsaved.get(id).catch(() => undefined);
      if (!active) return;
      const store = createEditorStore({
        projectId: id,
        meta: record.meta,
        data: { doc: loaded.doc, settings: record.settings, quote: record.quote },
        readOnly: loaded.readOnly,
      });
      const autosave = startAutosave(store, {
        projects: repos.projects,
        auth: repos.auth,
        unsaved,
        onSaved,
      });
      if (exposeTestHandle) window.__epd = { store };
      cleanup = () => {
        autosave.stop();
        if (window.__epd?.store === store) delete window.__epd;
      };
      setState({
        status: 'ready',
        store,
        autosave,
        restore: !loaded.readOnly && shouldOfferRestore(copy, record.meta.version) ? copy! : null,
      });
    })().catch((e: unknown) => {
      // An unexpected error (not a DocLoadError) must not leave the page on "Loading".
      console.error(e);
      if (active) setState({ status: 'failed' });
    });
    return () => {
      active = false;
      cleanup?.();
    };
  }, [id, repos, unsaved, exposeTestHandle, fetchRecord, onSaved]);

  if (state.status === 'loading')
    return <p className="p-4 text-text-muted">{t('common.loading')}</p>;
  if (state.status === 'not_found' || state.status === 'failed') {
    return (
      <div className="p-6">
        <p className="mb-3">
          {t(state.status === 'not_found' ? 'editor.notFound' : 'editor.loadFailed')}
        </p>
        <Link to="/projects" className="text-accent underline">
          {t('nav.projects')}
        </Link>
      </div>
    );
  }
  if (state.status === 'invalid') {
    return (
      <div className="mx-auto max-w-2xl p-6" role="alert">
        <h1 className="mb-2 text-xl font-semibold">{t('editor.recovery.title')}</h1>
        <p className="mb-3 text-text-muted">{t('editor.recovery.body')}</p>
        <ul className="mb-4 list-disc pl-5 font-mono text-sm" data-testid="doc-issues">
          {state.error.issues.slice(0, 10).map((issue, i) => (
            <li key={i}>{`${issue.path || '(root)'}: ${issue.message}`}</li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Button
            variant="primary"
            onClick={() => downloadJson(state.raw, `${state.name}-raw.json`)}
          >
            {t('editor.recovery.download')}
          </Button>
          <Link to="/projects" className="self-center text-accent underline">
            {t('nav.projects')}
          </Link>
        </div>
      </div>
    );
  }
  return (
    <EditorProvider store={state.store} autosave={state.autosave}>
      {renderFrame({
        restore: state.restore,
        onRestoreHandled: () => setState({ ...state, restore: null }),
      })}
    </EditorProvider>
  );
}
