import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRepositories } from '@/data';
import type { Session } from '@/data/types';

type AuthState =
  | { status: 'loading'; session: null }
  | { status: 'signedIn'; session: Session }
  | { status: 'signedOut'; session: null };

const AuthContext = createContext<AuthState>({ status: 'loading', session: null });

export function AuthProvider({ children }: { children: ReactNode }) {
  const { auth } = useRepositories();
  const [state, setState] = useState<AuthState>({ status: 'loading', session: null });

  useEffect(() => {
    let active = true;
    const apply = (session: Session | null) => {
      if (!active) return;
      setState(session ? { status: 'signedIn', session } : { status: 'signedOut', session: null });
    };
    void auth.getSession().then(apply);
    const unsubscribe = auth.onChange(apply);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [auth]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

/** Session of a signed-in route (inside RequireAuth). */
export function useSession(): Session {
  const state = useAuth();
  if (state.status !== 'signedIn') throw new Error('useSession outside RequireAuth');
  return state.session;
}
