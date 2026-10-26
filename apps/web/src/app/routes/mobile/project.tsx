import { Maximize, Minus, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLoaderData, useParams } from 'react-router';
import type { ProjectRecord } from '@/lib/repositories/types';
import { useRepositories } from '@/lib/repositories/provider';
import { openRecord } from '@/lib/projectFile/record';
import { loadDoc } from '@epd/domain/load';
import type { Point } from '@epd/domain/types';
import type { Autosave } from '@/stores/editor/autosave';
import { EditorProvider, useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import { createEditorStore, type EditorStore } from '@/stores/editor/editorStore';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { Tabs } from '@/components/ui/Tabs';
import { PlanCanvas } from '@/features/editor/canvas/PlanCanvas';
import { fitView, zoomAt } from '@/features/editor/canvas/viewport';
import { Checklist } from '@/features/bom/components/Checklist';

const noAutosave: Autosave = { flush: () => undefined, stop: () => undefined };

type State =
  { status: 'loading' | 'not_found' | 'failed' } | { status: 'ready'; store: EditorStore };

/** Mobile project route: the loader's record, remounted per project. */
export function MobileProjectRoute() {
  const record = useLoaderData<ProjectRecord | null>();
  const { id = '' } = useParams();
  return <MobileProjectPage key={id} record={record} />;
}

/** Mobile light view of one project: purchase checklist and read-only plan. */
function MobileProjectPage({ record }: { record: ProjectRecord | null }) {
  const { t } = useTranslation();
  const { files } = useRepositories();
  const [state, setState] = useState<State>(() =>
    record ? { status: 'loading' } : { status: 'not_found' },
  );

  // Builds the read-only store once; the record's backgrounds are downloaded as assets.
  useEffect(() => {
    if (!record) return;
    let active = true;
    void (async () => {
      const { doc } = loadDoc(record.rawDoc);
      const { project, assets } = await openRecord(record, doc, files);
      const store = createEditorStore({
        projectId: record.meta.id,
        data: project,
        assets,
        readOnly: true,
      });
      if (active) setState({ status: 'ready', store });
    })().catch(() => {
      if (active) setState({ status: 'failed' });
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.status === 'loading') return <p className="text-text-muted">{t('common.loading')}</p>;
  if (state.status !== 'ready') {
    return (
      <div className="flex flex-col gap-3">
        <p>{t(state.status === 'not_found' ? 'editor.notFound' : 'editor.loadFailed')}</p>
        <Link to="/m/projects" className="text-accent underline">
          {t('nav.projects')}
        </Link>
      </div>
    );
  }
  return (
    <EditorProvider store={state.store} autosave={noAutosave}>
      <MobileProject />
    </EditorProvider>
  );
}

function MobileProject() {
  const { t } = useTranslation();
  const meta = useEditor((s) => s.data.meta);
  return (
    <div className="flex flex-col gap-2">
      <div>
        <Link to="/m/projects" className="text-accent underline">
          {t('nav.projects')}
        </Link>
        <h1 className="text-xl font-semibold" data-testid="project-name">
          {meta.name}
        </h1>
        {meta.clientName ? <p className="text-text-muted">{meta.clientName}</p> : null}
      </div>
      <Tabs
        tabs={[
          { value: 'checklist', label: t('mobile.checklist'), content: <Checklist /> },
          { value: 'plan', label: t('mobile.plan'), content: <MobilePlan /> },
        ]}
      />
    </div>
  );
}

function MobilePlan() {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const doc = useEditor((s) => s.data.doc);
  const floorId = useEditor((s) => s.ui.floorId);
  const area = useRef<HTMLDivElement>(null);
  const floors = [...doc.floors].sort((a, b) => a.order - b.order);
  const size = () => ({
    width: area.current?.clientWidth || 360,
    height: area.current?.clientHeight || 480,
  });

  function fit() {
    const points: Point[] = [
      ...doc.nodes.filter((n) => n.floorId === floorId).map((n) => n.position),
      ...(doc.floors.find((f) => f.id === floorId)?.walls ?? []).flatMap((w) => [w.a, w.b]),
    ];
    if (points.length === 0) return;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    store.getState().setUi({
      view: fitView(
        {
          minX: Math.min(...xs),
          minY: Math.min(...ys),
          maxX: Math.max(...xs),
          maxY: Math.max(...ys),
        },
        size(),
        24,
      ),
    });
  }

  function zoom(factor: number) {
    const { width, height } = size();
    store.getState().setUi({
      view: zoomAt(store.getState().ui.view, { x: width / 2, y: height / 2 }, factor),
    });
  }

  // Fit the floor when it is shown or switched.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(fit, [floorId]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1" role="group" aria-label={t('mobile.floors')}>
        {floors.map((f) => (
          <Button
            key={f.id}
            variant={f.id === floorId ? 'primary' : 'secondary'}
            aria-pressed={f.id === floorId}
            onClick={() => store.getState().setUi({ floorId: f.id, selection: [] })}
          >
            {f.name}
          </Button>
        ))}
      </div>
      <div
        ref={area}
        className={cn(
          'relative h-[65vh] overflow-hidden rounded border-2 border-text bg-canvas-bg',
        )}
        data-testid="mobile-plan"
      >
        <PlanCanvas onCalibrationPoints={() => undefined} onDeleteRequest={() => undefined} />
        <div className="absolute right-2 bottom-2 flex flex-col gap-1">
          <Button aria-label={t('mobile.zoomIn')} onClick={() => zoom(1.5)}>
            <Plus size={18} />
          </Button>
          <Button aria-label={t('mobile.zoomOut')} onClick={() => zoom(1 / 1.5)}>
            <Minus size={18} />
          </Button>
          <Button aria-label={t('mobile.fit')} onClick={fit}>
            <Maximize size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
}
