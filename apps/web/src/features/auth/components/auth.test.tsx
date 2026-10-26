import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/testing/renderApp';

describe('auth', () => {
  // protects=protected routes; fails_when=a signed-out user sees the project list; no_claim=server-side RLS
  it('redirects signed-out users to login and back after logging in', async () => {
    const { router } = await renderApp('/projects', { signedIn: false });
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?next=%2Fprojects');
    await userEvent.type(screen.getByLabelText('Email'), 'dev@example.test');
    await userEvent.type(screen.getByLabelText('Password'), 'devpassword');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('heading', { name: 'Projects' })).toBeInTheDocument();
  });

  // protects=login error feedback; fails_when=wrong credentials fail silently; no_claim=rate limiting
  it('shows a translated error on wrong credentials', async () => {
    await renderApp('/login', { signedIn: false, lng: 'it' });
    await userEvent.type(await screen.findByLabelText('Email'), 'dev@example.test');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Accedi' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email o password errate.');
  });

  // protects=sign up; fails_when=a new account does not land on the start screen; no_claim=email confirmation
  it('signs up and lands on the start screen', async () => {
    await renderApp('/signup', { signedIn: false, seed: false });
    await userEvent.type(await screen.findByLabelText('Email'), 'new@example.test');
    await userEvent.type(screen.getByLabelText('Password'), 'secret-pw');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('heading', { name: 'Start' })).toBeInTheDocument();
  });

  // protects=session expiry; fails_when=an expired session leaves the user on a protected page; no_claim=unsaved state (editor step)
  it('redirects to login when the session expires', async () => {
    const { control, router } = await renderApp('/projects');
    await screen.findByRole('heading', { name: 'Projects' });
    act(() => control.expireSession());
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?next=%2Fprojects');
  });
});
