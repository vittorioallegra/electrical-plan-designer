import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { newFloor } from '@epd/domain/defaults';
import { cascadeOf, deleteFloor, moveFloor } from '@epd/domain/edits';
import { newId } from '@epd/domain/ids';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { PanelSection } from '@/components/ui/PanelSection';
import { TextField } from '@/components/ui/TextField';
import { formatLength } from '@/lib/format';
import { Dialog } from '@/components/ui/Dialog';
import { NumberInput } from '@/components/ui/NumberInput';
import { cn } from '@/lib/cn';

export function FloorsPanel() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'it' ? 'it' : 'en';
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
    <>
      <PanelSection
        title={t('editor.floors')}
        actions={
          <IconButton
            label={t('editor.floor.add')}
            icon={<Plus size={16} />}
            onClick={addFloor}
            disabled={readOnly}
          />
        }
      >
        <div role="tablist" aria-label={t('editor.floors')} className="flex flex-col gap-0.5">
          {[...floors].reverse().map((f) => (
            <button
              key={f.id}
              role="tab"
              type="button"
              aria-selected={f.id === activeId}
              title={f.name}
              aria-label={f.name}
              className={cn(
                'flex h-7 items-center gap-2 rounded-sm px-2 text-left focus-visible:outline-2 focus-visible:outline-offset-1',
                f.id === activeId
                  ? 'bg-accent-subtle font-medium text-accent-text'
                  : 'hover:bg-hover',
              )}
              onClick={() => store.getState().setUi({ floorId: f.id, selection: [] })}
            >
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="font-mono text-small text-text-faint tabular-nums">
                {formatLength(f.height, locale)}
              </span>
            </button>
          ))}
        </div>
      </PanelSection>
      {active ? (
        <PanelSection
          title={t('editor.floor.properties')}
          actions={
            <>
              <IconButton
                label={t('editor.floor.moveUp')}
                icon={<ArrowUp size={16} />}
                disabled={readOnly || active.order === floors.length - 1}
                onClick={() =>
                  apply(
                    'move floor',
                    (d) => void moveFloor(d.doc, active.id, active.order + 1, newId),
                  )
                }
              />
              <IconButton
                label={t('editor.floor.moveDown')}
                icon={<ArrowDown size={16} />}
                disabled={readOnly || active.order === 0}
                onClick={() =>
                  apply(
                    'move floor',
                    (d) => void moveFloor(d.doc, active.id, active.order - 1, newId),
                  )
                }
              />
              <IconButton
                label={t('editor.floor.delete')}
                icon={<Trash2 size={16} />}
                disabled={readOnly || floors.length === 1}
                onClick={() => setDeleting(active.id)}
              />
            </>
          }
        >
          <div className="flex flex-col gap-2">
            <TextField
              key={active.id}
              label={t('editor.floor.name')}
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
            <label className="flex flex-col gap-1 text-small text-text-muted">
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
          </div>
        </PanelSection>
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
    </>
  );
}
