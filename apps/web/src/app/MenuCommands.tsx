import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useProjectOpener } from '@/features/start/hooks/useProjectOpener';
import { useEditorServices } from '@/stores/editor/EditorContext';

/**
 * The native menu's project commands (New, Open, Open Recent, Close project) and the files the OS
 * asks to open. They run the start screen's own actions, so they ask the same unsaved-changes
 * question. Save, Save As, Undo and Redo are handled by `WindowSync`.
 */
export function MenuCommands() {
  const { windowHost } = useEditorServices();
  const navigate = useNavigate();
  const opener = useProjectOpener();
  // The listeners are set once: a gap while they are replaced would lose a request from the OS.
  const latest = useRef({ opener, navigate });
  useEffect(() => {
    latest.current = { opener, navigate };
  });

  useEffect(
    () =>
      windowHost.onMenuCommand((command) => {
        const { opener, navigate } = latest.current;
        switch (command.command) {
          case 'new':
            // The start screen opens its new-project form (after the same question).
            void navigate('/', { state: { command: 'new' } });
            break;
          case 'open':
            opener.openFile();
            break;
          case 'openRecent':
            opener.openPath(command.path);
            break;
          case 'close':
            opener.closeProject();
            break;
        }
      }),
    [windowHost],
  );

  useEffect(
    () => windowHost.onOpenRequest((path) => latest.current.opener.openPath(path)),
    [windowHost],
  );

  return opener.dialog;
}
