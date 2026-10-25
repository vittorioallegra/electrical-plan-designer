import { useEffect } from 'react';
import type { PanelDevice } from '@epd/domain/types';
import { deleteDevice, moveDevice } from '@/features/panel/utils/commands';
import type { EditorStore } from '@/stores/editor/editorStore';

/** Arrow keys move the selected device by a slot or a rail; Delete/Backspace removes it. */
export function usePanelKeyboard(
  store: EditorStore,
  selected: PanelDevice | undefined,
  readOnly: boolean,
) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        !selected ||
        readOnly ||
        (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      )
        return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        moveDevice(
          store,
          selected.id,
          selected.rail,
          selected.slot + (e.key === 'ArrowLeft' ? -1 : 1),
        );
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        moveDevice(
          store,
          selected.id,
          selected.rail + (e.key === 'ArrowUp' ? -1 : 1),
          selected.slot,
        );
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteDevice(store, selected.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, readOnly, store]);
}
