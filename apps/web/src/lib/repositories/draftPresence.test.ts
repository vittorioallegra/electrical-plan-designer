// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createDraftPresence } from './draftPresence';

let channels = 0;
const pair = () => {
  const channelName = `presence-test-${++channels}`;
  return [createDraftPresence({ channelName }), createDraftPresence({ channelName })] as const;
};

describe('draft presence', () => {
  // protects=one writer per draft; fails_when=a tab cannot see that another tab holds the draft, or a tab that stopped holding still answers; no_claim=crashed tabs (they just stop answering)
  it('reports the tab holding the draft', async () => {
    const [here, other] = pair();
    expect(await here.holder()).toBeNull();
    other.hold(() => ({ name: 'Demo house', unsaved: true }));
    expect(await here.holder()).toEqual({ name: 'Demo house', unsaved: true });
    other.hold(null);
    expect(await here.holder()).toBeNull();
  });

  // protects=lossless takeover; fails_when=a claim returns before the holder has written its last changes, or the holder keeps holding; no_claim=IndexedDB ordering
  it('waits for the holder to let go when taking over', async () => {
    const [here, other] = pair();
    const steps: string[] = [];
    other.hold(() => ({ name: 'Demo house', unsaved: false }));
    other.onTakenOver(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      steps.push('released');
    });
    await here.claim();
    steps.push('claimed');
    expect(steps).toEqual(['released', 'claimed']);
    expect(await here.holder()).toBeNull();
  });
});
