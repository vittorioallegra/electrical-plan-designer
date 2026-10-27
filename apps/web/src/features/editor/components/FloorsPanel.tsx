import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { newFloor } from '@epd/domain/defaults';
import { cascadeOf, deleteFloor, moveFloor } from '@epd/domain/edits';
import { newId } from '@epd/domain/ids';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { NumberInput } from '@/components/ui/NumberInput';
import { cn } from '@/lib/cn';

export function FloorsPanel() {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const rawFloors = useEditor((s) => s.data.doc.floors);
  const floors = useMemo(() => [...rawFloors].sort((a, b) => a.order - b.order), [rawFloors]);
  const activeId = useEditor((s) => s.ui.floorId);
  const readOnly = useEditor((s) => s.readOnly);
  const [deleting, setDeleting] = useState<string | null>(null);
  const active = floors.find((f) => f.id === activeId);
  const apply = store.getState().applyCommand;

  function addFloor() {
    const s = store.getState();
    const floor = newFloor(
      t('editor.floor.defaultName', { n: s.data.doc.floors.length + 1 }),
      s.data.doc.floors.length,
      s.data.settings,
    );
    if (apply('add floor', (d) => void d.doc.floors.push(floor)).ok) s.setUi({ floorId: floor.id });
  }

  const deletingSummary = deleting
    ? cascadeOf(
        store.getState().data.doc,
        store
          .getState()
          .data.doc.nodes.filter((n) => n.floorId === deleting)
          .map((n) => n.id),
      )
    : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">{t('editor.floors')}</h2>
        <Button
          variant="ghost"
          aria-label={t('editor.floor.add')}
          onClick={addFloor}
          disabled={readOnly}
        >
          <Plus size={16} />
        </Button>
      </div>
      <div role="tablist" aria-label={t('editor.floors')} className="flex flex-col gap-0.5">
        {[...floors].reverse().map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={f.id === activeId}
            className={cn(
              'truncate rounded px-2 py-1 text-left',
              f.id === activeId ? 'bg-surface-muted font-medium' : 'hover:bg-surface-muted',
            )}
            onClick={() => store.getState().setUi({ floorId: f.id, selection: [] })}
          >
            {f.name}
          </button>
        ))}
      </div>
      {active ? (
        <div className="flex flex-col gap-2 border-t border-border pt-2">
          <label className="flex flex-col gap-1">
            {t('editor.floor.name')}
            <input
              key={active.id}
              className="h-[var(--control-height)] rounded border border-border px-2"
              defaultValue={active.name}
              disabled={readOnly}
              onBlur={(e) => {
                const name = e.target.value.trim();
                if (name && name !== active.name) {
                  apply('rename floor', (d) => {
                    d.doc.floors.find((f) => f.id === active.id)!.name = name;
                  });
                }
              }}
            />
          </label>
          <label className="flex flex-col gap-1">
            {t('editor.floor.height')}
            <NumberInput
              aria-label={t('editor.floor.height')}
              value={active.height}
              unit="m"
              min={0.5}
              max={20}
              disabled={readOnly}
              onValueChange={(height) =>
                apply('floor height', (d) => {
                  d.doc.floors.find((f) => f.id === active.id)!.height = height;
                })
              }
            />
          </label>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              aria-label={t('editor.floor.moveUp')}
              disabled={readOnly || active.order === floors.length - 1}
              onClick={() =>
                apply(
                  'move floor',
                  (d) => void moveFloor(d.doc, active.id, active.order + 1, newId),
                )
              }
            >
              <ArrowUp size={16} />
            </Button>
            <Button
              variant="ghost"
              aria-label={t('editor.floor.moveDown')}
              disabled={readOnly || active.order === 0}
              onClick={() =>
                apply(
                  'move floor',
                  (d) => void moveFloor(d.doc, active.id, active.order - 1, newId),
                )
              }
            >
              <ArrowDown size={16} />
            </Button>
            <Button
              variant="ghost"
              aria-label={t('editor.floor.delete')}
              disabled={readOnly || floors.length === 1}
              onClick={() => setDeleting(active.id)}
            >
              <Trash2 size={16} />
            </Button>
          </div>
        </div>
      ) : null}
      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('editor.floor.deleteTitle', {
          name: floors.find((f) => f.id === deleting)?.name ?? '',
        })}
        description={t('editor.floor.deleteBody', {
          nodes: deletingSummary?.nodeIds.length ?? 0,
          segments: deletingSummary?.segmentIds.length ?? 0,
          circuits: deletingSummary?.circuitIds.length ?? 0,
        })}
        footer={
          <>
            <Button onClick={() => setDeleting(null)}>{t('common.cancel')}</Button>
            <Button
              variant="danger-ghost"
              onClick={() => {
                const id = deleting!;
                setDeleting(null);
                apply('delete floor', (d) => void deleteFloor(d.doc, id, newId));
              }}
            >
              {t('editor.floor.delete')}
            </Button>
          </>
        }
      />
    </div>
  );
}
