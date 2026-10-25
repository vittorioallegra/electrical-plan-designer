import { createContext, redirect, type MiddlewareFunction } from 'react-router';
import type { Repositories, Session } from '@/lib/repositories/types';

/** Session of the signed-in user, set by `authMiddleware` for the loaders below it. */
export const sessionContext = createContext<Session>();

/**
 * Runs before every loader of the protected routes: without a session it redirects to the
 * login (coming back afterwards), so no repository is called for a signed-out visitor.
 */
export function authMiddleware(repos: Repositories): MiddlewareFunction {
  return async ({ request, context }, next) => {
    const session = await repos.auth.getSession();
    if (!session) {
      const url = new URL(request.url);
      throw redirect(`/login?next=${encodeURIComponent(`${url.pathname}${url.search}`)}`);
    }
    context.set(sessionContext, session);
    return next();
  };
}
