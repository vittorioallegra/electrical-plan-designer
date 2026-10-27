import { Outlet } from 'react-router';
import { useTitleBarInset } from '@/lib/platform';
import { TitleBarStrip } from '@/components/TitleBarStrip';
import { LibraryNotices } from '@/app/LibraryNotices';

/**
 * Frame of the pages outside a project (the start screen, Settings). On macOS the window has no
 * native title bar, so a drag strip over the top keeps the window movable and the traffic lights
 * clear of the content.
 */
export function AppShell() {
  const inset = useTitleBarInset();
  return (
    <div data-density="compact" className="flex h-screen flex-col bg-surface text-text">
      {inset ? <TitleBarStrip /> : null}
      <LibraryNotices />
      <div className="min-h-0 flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
