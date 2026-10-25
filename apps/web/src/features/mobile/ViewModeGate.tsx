import { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { mobilePathFor, resolveViewMode } from './viewMode';

/** Sends phones to the mobile light view; the mode is fixed for the session. */
export function ViewModeGate() {
  const { pathname } = useLocation();
  const [mode] = useState(() => resolveViewMode());
  const target = mode === 'mobile' ? mobilePathFor(pathname) : null;
  return target ? <Navigate to={target} replace /> : <Outlet />;
}
