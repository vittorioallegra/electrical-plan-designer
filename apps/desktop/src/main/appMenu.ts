// The application menu: builds it from `menu.ts` once the renderer has sent its labels, and again
// when the labels, the recent list or whether the focused window has a project change.
import { app, BrowserWindow, dialog, Menu } from 'electron';
import type { MenuCommand, MenuLabels } from '@epd/bridge/bridge';
import { buildMenuTemplate } from './menu';
import type { RecentService } from './recent';
import { APP_NAME } from './windowTitle';

export interface AppMenu {
  setLabels(labels: MenuLabels): void;
  /** The project `win` has open (null: none) and whether it is read-only; the menu follows the focused window's. */
  setProject(win: BrowserWindow, project: { readOnly: boolean } | null): void;
  refresh(): Promise<void>;
}

export function createAppMenu({
  recent,
  send,
}: {
  recent: RecentService;
  send(command: MenuCommand): void;
}): AppMenu {
  let labels: MenuLabels | null = null;
  const projectWindows = new WeakMap<BrowserWindow, { readOnly: boolean }>();
  let latest = 0;

  async function refresh(): Promise<void> {
    if (!labels) return;
    const current = labels;
    const run = ++latest;
    const list = await recent.list();
    // A newer refresh started while the list was read: let that one win.
    if (run !== latest) return;
    const focused = BrowserWindow.getFocusedWindow();
    const project = focused ? projectWindows.get(focused) : undefined;
    const template = buildMenuTemplate({
      labels: current,
      platform: process.platform,
      hasProject: project !== undefined,
      readOnly: project?.readOnly ?? false,
      recent: list,
      development: !app.isPackaged,
      appName: APP_NAME,
      send,
      showAbout: () => {
        const options = {
          type: 'info' as const,
          title: APP_NAME,
          message: APP_NAME,
          detail: `${current.version} ${app.getVersion()}`,
        };
        const win = BrowserWindow.getFocusedWindow();
        void (win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options));
      },
    });
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  }

  return {
    setLabels(next) {
      labels = next;
      void refresh();
    },
    setProject(win, next) {
      const before = projectWindows.get(win);
      if (before?.readOnly === next?.readOnly && (before === undefined) === (next === null)) return;
      if (next) projectWindows.set(win, next);
      else projectWindows.delete(win);
      void refresh();
    },
    refresh,
  };
}
