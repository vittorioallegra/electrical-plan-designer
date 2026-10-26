import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';
import { createI18n } from '@/lib/i18n';
import { FileDropZone } from './FileDropZone';

function renderZone(onFile = vi.fn()) {
  render(
    <I18nextProvider i18n={createI18n('en')}>
      <FileDropZone accept="image/png" onFile={onFile} inputTestId="file" />
    </I18nextProvider>,
  );
  return { onFile, zone: screen.getByTestId('file-drop-zone') };
}

const png = () => new File(['x'], 'plan.png', { type: 'image/png' });

describe('FileDropZone', () => {
  // protects=drop to import; fails_when=a dropped file is not passed on or the zone stays highlighted; no_claim=file type checks (left to the caller)
  it('passes on a dropped file and highlights the zone while dragging', () => {
    const { onFile, zone } = renderZone();
    const file = png();
    fireEvent.dragOver(zone, { dataTransfer: { types: ['Files'], files: [] } });
    expect(zone).toHaveAttribute('data-dragging', 'true');
    fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file);
    expect(zone).not.toHaveAttribute('data-dragging');
  });

  // protects=button fallback; fails_when="Choose file" does not open the picker or a picked file is lost; no_claim=native dialog
  it('opens the file picker from the button and passes on the picked file', async () => {
    const { onFile } = renderZone();
    const input = screen.getByTestId<HTMLInputElement>('file');
    const click = vi.spyOn(input, 'click');
    await userEvent.click(screen.getByRole('button', { name: 'Choose file' }));
    expect(click).toHaveBeenCalled();
    const file = png();
    await userEvent.upload(input, file);
    expect(onFile).toHaveBeenCalledWith(file);
  });

  // protects=staying in the app; fails_when=a file dropped beside the zone makes the browser open it; no_claim=drops after the zone unmounts
  it('stops the browser from opening a file dropped outside the zone', () => {
    renderZone();
    const drop = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', { value: { types: ['Files'] } });
    window.dispatchEvent(drop);
    expect(drop.defaultPrevented).toBe(true);
  });
});
