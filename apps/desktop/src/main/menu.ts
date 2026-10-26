// The native menu as plain data (Electron's `MenuItemConstructorOptions`), so its structure is
// tested without Electron. Labels come from the renderer (the app's language); every item that is
// not a standard role sends a command to the renderer, which runs the matching in-app action.
import type { MenuItemConstructorOptions } from 'electron';
import type { MenuCommand, MenuLabels, RecentFile } from '@epd/bridge/bridge';

export interface MenuInput {
  labels: MenuLabels;
  platform: NodeJS.Platform;
  /** A project is open: Save, Save As and Close project are available. */
  hasProject: boolean;
  recent: RecentFile[];
  /** Developer tools in the View menu (an unpackaged app). */
  development: boolean;
  appName: string;
  send(command: MenuCommand): void;
  showAbout(): void;
}

export function buildMenuTemplate(input: MenuInput): MenuItemConstructorOptions[] {
  const { labels: l, platform, hasProject, recent, send } = input;
  const mac = platform === 'darwin';

  const recentItems: MenuItemConstructorOptions[] =
    recent.length === 0
      ? [{ label: l.noRecent, enabled: false }]
      : recent.map((file) => ({
          label: file.missing ? `${file.name} (${l.missing})` : file.name,
          // The full path as the tooltip where menus show one; missing files cannot be opened.
          sublabel: file.path,
          enabled: !file.missing,
          click: () => send({ command: 'openRecent', path: file.path }),
        }));

  const fileMenu: MenuItemConstructorOptions = {
    label: l.file,
    submenu: [
      { label: l.new, accelerator: 'CmdOrCtrl+N', click: () => send({ command: 'new' }) },
      { label: l.open, accelerator: 'CmdOrCtrl+O', click: () => send({ command: 'open' }) },
      { label: l.openRecent, submenu: recentItems },
      { type: 'separator' },
      {
        label: l.save,
        accelerator: 'CmdOrCtrl+S',
        enabled: hasProject,
        click: () => send({ command: 'save' }),
      },
      {
        label: l.saveAs,
        accelerator: 'CmdOrCtrl+Shift+S',
        enabled: hasProject,
        click: () => send({ command: 'saveAs' }),
      },
      { type: 'separator' },
      {
        label: l.close,
        // Cmd+W closes the window on macOS by convention; the project has its own shortcut.
        accelerator: 'CmdOrCtrl+Shift+W',
        enabled: hasProject,
        click: () => send({ command: 'close' }),
      },
      ...(mac ? [] : ([{ type: 'separator' }, { role: 'quit' }] as MenuItemConstructorOptions[])),
    ],
  };

  const editMenu: MenuItemConstructorOptions = {
    label: l.edit,
    submenu: [
      { label: l.undo, accelerator: 'CmdOrCtrl+Z', click: () => send({ command: 'undo' }) },
      {
        label: l.redo,
        accelerator: mac ? 'Shift+Cmd+Z' : 'Ctrl+Y',
        click: () => send({ command: 'redo' }),
      },
      { type: 'separator' },
      { role: 'cut', label: l.cut },
      { role: 'copy', label: l.copy },
      { role: 'paste', label: l.paste },
      { role: 'selectAll', label: l.selectAll },
    ],
  };

  const viewMenu: MenuItemConstructorOptions = {
    label: l.view,
    submenu: [
      { role: 'zoomIn', label: l.zoomIn },
      { role: 'zoomOut', label: l.zoomOut },
      { role: 'resetZoom', label: l.resetZoom },
      { type: 'separator' },
      { role: 'togglefullscreen', label: l.fullScreen },
      ...(input.development
        ? ([{ type: 'separator' }, { role: 'toggleDevTools' }] as MenuItemConstructorOptions[])
        : []),
    ],
  };

  const helpMenu: MenuItemConstructorOptions = {
    label: l.help,
    role: 'help',
    submenu: [{ label: `${l.about} ${input.appName}`, click: () => input.showAbout() }],
  };

  return [
    ...(mac
      ? ([
          {
            label: input.appName,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ] as MenuItemConstructorOptions[])
      : []),
    fileMenu,
    editMenu,
    viewMenu,
    helpMenu,
  ];
}
