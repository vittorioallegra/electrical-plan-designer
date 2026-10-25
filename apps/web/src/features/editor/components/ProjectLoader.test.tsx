import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type * as Load from '@epd/domain/load';
import { DEMO_PROJECT_ID, renderApp } from '@/testing/renderApp';

vi.mock('@epd/domain/load', async (importOriginal) => ({
  ...(await importOriginal<typeof Load>()),
  loadDoc: () => {
    throw new TypeError('unexpected');
  },
}));

describe('project loader', () => {
  // protects=unexpected load errors; fails_when=an error other than DocLoadError leaves the page on "Loading"; no_claim=DocLoadError recovery screen
  it('shows the load error instead of loading forever', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    await renderApp(`/projects/${DEMO_PROJECT_ID}/plan`);
    expect(await screen.findByText(/Could not load the project/)).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).toBeNull();
    expect(consoleError).toHaveBeenCalled();
  });
});
