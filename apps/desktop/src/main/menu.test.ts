import type { MenuItemConstructorOptions } from 'electron';
import { describe, expect, it } from 'vitest';
import { menuLabelKeys, type MenuCommand, type MenuLabels } from '@epd/bridge/bridge';
import { buildMenuTemplate } from './menu';

const labels = Object.fromEntries(menuLabelKeys.map((k) => [k, `L:${k}`])) as MenuLabels;

function build(over: Partial<Parameters<typeof buildMenuTemplate>[0]> = {}) {
  const sent: MenuCommand[] = [];
  const template = buildMenuTemplate({
    labels,
    platform: 'win32',
    hasProject: true,
    recent: [],
    development: false,
    appName: 'App',
    send: (c) => sent.push(c),
    showAbout: () => undefined,
    ...over,
  });
  return { template, sent };
}

const items = (menu: MenuItemConstructorOptions | undefined) =>
  (menu?.submenu ?? []) as MenuItemConstructorOptions[];
const find = (list: MenuItemConstructorOptions[], label: string) =>
  list.find((i) => i.label === `L:${label}`);

describe('application menu', () => {
  // protects=AC 6 menu commands and shortcuts; fails_when=a File or Edit item lacks its CmdOrCtrl accelerator, does not send its command, or Save/Save As/Close stay enabled without a project; no_claim=the native rendering
  it('sends the file and edit commands with their shortcuts', () => {
    const { template, sent } = build({ hasProject: false });
    const file = items(find(template, 'file'));
    const edit = items(find(template, 'edit'));
    const expected: [MenuItemConstructorOptions[], string, string, MenuCommand['command']][] = [
      [file, 'new', 'CmdOrCtrl+N', 'new'],
      [file, 'open', 'CmdOrCtrl+O', 'open'],
      [file, 'save', 'CmdOrCtrl+S', 'save'],
      [file, 'saveAs', 'CmdOrCtrl+Shift+S', 'saveAs'],
      [file, 'close', 'CmdOrCtrl+Shift+W', 'close'],
      [edit, 'undo', 'CmdOrCtrl+Z', 'undo'],
    ];
    for (const [list, key, accelerator, command] of expected) {
      const item = find(list, key)!;
      expect(item.accelerator).toBe(accelerator);
      item.click?.(undefined as never, undefined, undefined as never);
      expect(sent.at(-1)).toEqual({ command });
    }
    expect(find(file, 'save')!.enabled).toBe(false);
    expect(find(file, 'saveAs')!.enabled).toBe(false);
    expect(find(file, 'close')!.enabled).toBe(false);
    expect(find(file, 'new')!.enabled).toBeUndefined();
    expect(find(items(find(build().template, 'file')), 'save')!.enabled).toBe(true);
  });

  // protects=AC 7 Open Recent; fails_when=the recent files are not listed in order, a missing file can be clicked or is not marked, or a click does not send the path; no_claim=the list's contents (recent tests)
  it('lists the recent files, marks missing ones and sends the path', () => {
    const recent = [
      { path: '/p/a.epd', name: 'a.epd', missing: false },
      { path: '/p/b.epd', name: 'b.epd', missing: true },
    ];
    const { template, sent } = build({ recent });
    const submenu = items(find(items(find(template, 'file')), 'openRecent'));
    expect(submenu.map((i) => i.label)).toEqual(['a.epd', 'b.epd (L:missing)']);
    expect(submenu.map((i) => i.enabled)).toEqual([true, false]);
    submenu[0]!.click?.(undefined as never, undefined, undefined as never);
    expect(sent).toEqual([{ command: 'openRecent', path: '/p/a.epd' }]);
    const empty = items(find(items(find(build().template, 'file')), 'openRecent'));
    expect(empty).toEqual([{ label: 'L:noRecent', enabled: false }]);
  });

  // protects=platform conventions; fails_when=macOS lacks its app menu or Windows gets one, Quit is missing from File on Windows, or dev tools show in a packaged app; no_claim=the standard roles' behavior
  it('follows the platform and hides developer tools when packaged', () => {
    const mac = build({ platform: 'darwin' }).template;
    expect(mac[0]!.label).toBe('App');
    expect(items(find(mac, 'file')).some((i) => i.role === 'quit')).toBe(false);
    const win = build().template;
    expect(win[0]!.label).toBe('L:file');
    expect(items(win[0]).some((i) => i.role === 'quit')).toBe(true);
    const view = (t: MenuItemConstructorOptions[]) => items(find(t, 'view'));
    expect(view(win).some((i) => i.role === 'toggleDevTools')).toBe(false);
    expect(
      view(build({ development: true }).template).some((i) => i.role === 'toggleDevTools'),
    ).toBe(true);
  });
});
