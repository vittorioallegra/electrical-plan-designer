import { Outlet } from 'react-router';

/** Frame of the pages outside a project (the start screen, Settings). */
export function AppShell() {
  return (
    <div data-density="compact" className="min-h-screen bg-surface text-text">
      <Outlet />
    </div>
  );
}
