import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useProjectOpener } from '@/features/start/hooks/useProjectOpener';
import { useEditorServices, useWorkspace } from '@/stores/editor/EditorContext';

/**
 * The native menu's app commands (New, Open, Open Recent, Close project, Settings) and the files the OS
 * asks to open. They run the start screen's own actions, so they ask the same unsaved-changes
 * question. Save, Save As, Undo and Redo are handled by `WindowSync`; Export and Import JSON by the project frame.
 */
export function MenuCommands() {
  const { windowHost } = useEditorServices();
  const navigate = useNavigate();
  const opener = useProjectOpener();
  const location = useLocation();
  const hasProject = useWorkspace((s) => s.current !== null);
  // The listeners are set once: a gap while they are replaced would lose a request from the OS.
  const latest = useRef({ opener, navigate, location, hasProject });
  useEffect(() => {
    latest.current = { opener, navigate, location, hasProject };
  });

  useEffect(
    () =>
      windowHost.onMenuCommand((command) => {
        const { opener, navigate, location, hasProject } = latest.current;
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
          case 'settings':
            // The project stays open (the workspace keeps it) while Settings are on screen.
            void navigate('/settings/general');
            break;
          case 'exportPdf':
          case 'exportJson':
          case 'importJson':
            // The project frame runs these; from another page the user is taken there first.
            if (hasProject && !location.pathname.startsWith('/project'))
              void navigate('/project/plan', { state: { command: command.command } });
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
