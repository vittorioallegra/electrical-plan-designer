import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRepositories } from '@/lib/repositories/provider';
import type { Session } from '@/lib/repositories/types';

type AuthState =
  | { status: 'loading'; session: null }
  | { status: 'signedIn'; session: Session }
  | { status: 'signedOut'; session: null };

const AuthContext = createContext<AuthState>({ status: 'loading', session: null });

export function AuthProvider({ children }: { children: ReactNode }) {
  const { auth } = useRepositories();
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading', session: null });
  // User of the data in the query cache; it is dropped on sign-out or a change of user.
  const cachedUser = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    const apply = (session: Session | null) => {
      if (!active) return;
      const userId = session?.userId ?? null;
      if (userId !== cachedUser.current) {
        queryClient.clear();
        cachedUser.current = userId;
      }
      setState(session ? { status: 'signedIn', session } : { status: 'signedOut', session: null });
    };
    void auth.getSession().then(apply);
    const unsubscribe = auth.onChange(apply);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [auth, queryClient]);

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
