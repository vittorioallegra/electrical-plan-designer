import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { TitleBarDrawnProvider } from '@/components/TitleBarStrip';
import { createI18n } from '@/lib/i18n';
import { ErrorState } from './RouteError';

function renderState(drawn: boolean) {
  return render(
    <I18nextProvider i18n={createI18n('en')}>
      <MemoryRouter>
        <TitleBarDrawnProvider value={drawn}>
          <ErrorState messageKey="errors.unexpected" backTo="/" />
        </TitleBarDrawnProvider>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

function fakeDesktop(platform: string) {
  (window as unknown as { epd: unknown }).epd = {
    platform,
    window: { isFullScreen: () => Promise.resolve(false), onFullScreenChange: () => () => {} },
  };
}

describe('ErrorState title bar', () => {
  afterEach(() => {
    delete (window as unknown as { epd?: unknown }).epd;
  });

  // protects=an error screen that replaced a whole frame gets the macOS drag strip; fails_when=the strip is missing on macOS desktop, or doubled under a frame that has one; no_claim=the pixels (Electron E2E)
  it('draws the drag strip on macOS only when no frame above has one', () => {
    fakeDesktop('darwin');
    const { unmount } = renderState(false);
    expect(screen.getByTestId('title-bar-strip')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    unmount();
    renderState(true);
    expect(screen.queryByTestId('title-bar-strip')).toBeNull();
  });

  // protects=no strip where the OS draws the title bar; fails_when=a strip shows in a browser or on Windows; no_claim=none
  it('draws no strip in a browser or on Windows', () => {
    const { unmount } = renderState(false);
    expect(screen.queryByTestId('title-bar-strip')).toBeNull();
    unmount();
    fakeDesktop('win32');
    renderState(false);
    expect(screen.queryByTestId('title-bar-strip')).toBeNull();
  });
});
