// The application menu: builds it from `menu.ts` once the renderer has sent its labels, and again
// when the labels, the recent list or whether the focused window has a project change.
import { app, BrowserWindow, dialog, Menu } from 'electron';
import type { MenuCommand, MenuLabels } from '@epd/bridge/bridge';
import { buildMenuTemplate } from './menu';
import type { RecentService } from './recent';
import { APP_NAME } from './windowTitle';

export interface AppMenu {
  setLabels(labels: MenuLabels): void;
  /** Whether `win` has a project open; the menu follows the focused window's. */
  setHasProject(win: BrowserWindow, hasProject: boolean): void;
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
  const projectWindows = new WeakSet<BrowserWindow>();
  let latest = 0;

  async function refresh(): Promise<void> {
    if (!labels) return;
    const current = labels;
    const run = ++latest;
    const list = await recent.list();
    // A newer refresh started while the list was read: let that one win.
    if (run !== latest) return;
    const focused = BrowserWindow.getFocusedWindow();
    const hasProject = focused !== null && projectWindows.has(focused);
    const template = buildMenuTemplate({
      labels: current,
      platform: process.platform,
      hasProject,
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
    setHasProject(win, next) {
      if (next === projectWindows.has(win)) return;
      if (next) projectWindows.add(win);
      else projectWindows.delete(win);
      void refresh();
    },
    refresh,
  };
}
