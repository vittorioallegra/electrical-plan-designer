import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { useRepositories } from '@/data';
import { AuthError } from '@/data/types';
import { Button } from '@/ui/Button';
import { useAuth } from './AuthProvider';

function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/projects';
}

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const { t } = useTranslation();
  const { auth } = useRepositories();
  const state = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (state.status === 'signedIn' && !busy) return <Navigate to={next} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') await auth.signIn(email, password);
      else await auth.signUp(email, password);
      navigate(next, { replace: true });
    } catch (err) {
      setError(t(`auth.errors.${err instanceof AuthError ? err.code : 'unknown'}`));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-12 flex max-w-sm flex-col gap-3" noValidate>
      <h1 className="text-xl font-semibold">
        {t(mode === 'login' ? 'pages.login' : 'pages.signup')}
      </h1>
      <label className="flex flex-col gap-1">
        {t('auth.email')}
        <input
          type="email"
          autoComplete="email"
          required
          className="rounded border border-border px-2 py-1.5"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1">
        {t('auth.password')}
        <input
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          required
          minLength={6}
          className="rounded border border-border px-2 py-1.5"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error ? (
        <p role="alert" className="rounded bg-error-bg px-2 py-1 text-error">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" disabled={busy || !email || !password}>
        {t(mode === 'login' ? 'auth.logIn' : 'auth.signUp')}
      </Button>
      <p className="text-text-muted">
        {mode === 'login' ? (
          <Link to={`/signup?next=${encodeURIComponent(next)}`} className="text-accent underline">
            {t('auth.noAccount')}
          </Link>
        ) : (
          <Link to={`/login?next=${encodeURIComponent(next)}`} className="text-accent underline">
            {t('auth.haveAccount')}
          </Link>
        )}
      </p>
    </form>
  );
}
