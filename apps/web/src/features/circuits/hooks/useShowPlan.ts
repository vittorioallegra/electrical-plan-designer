import { useLocation, useNavigate } from 'react-router';

const PLAN = '/project/plan';

/** Picking happens on the plan canvas: opens the plan when the drawer is used elsewhere. */
export function useShowPlan(): () => void {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return () => {
    if (pathname !== PLAN) void navigate(PLAN);
  };
}
