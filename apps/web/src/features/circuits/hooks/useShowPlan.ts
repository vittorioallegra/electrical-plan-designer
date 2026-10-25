import { useLocation, useNavigate, useParams } from 'react-router';

/** Picking happens on the plan canvas: opens the plan when the drawer is used elsewhere. */
export function useShowPlan(): () => void {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { id = '' } = useParams();
  return () => {
    const plan = `/projects/${id}/plan`;
    if (id && pathname !== plan) void navigate(plan);
  };
}
