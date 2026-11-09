import { describe, expect, it } from 'vitest';
import { builtinCatalog } from './builtin';

const ofCategory = (category: string) => builtinCatalog.filter((i) => i.category === category);

describe('built-in catalog', () => {
  // protects=plates for every built-in box, smaller ones included; fails_when=a plate size from 1 to the largest box is missing (a 503 takes 1, 2 or 3 module plates); no_claim=user catalogs
  it('has a plate for every size up to the largest built-in wall box', () => {
    const largest = Math.max(...ofCategory('box').map((b) => b.modules ?? 0));
    expect(ofCategory('plate').map((p) => p.modules)).toEqual(
      Array.from({ length: largest }, (_, i) => i + 1),
    );
  });

  // protects=two-pole protection and aerial sockets in the default catalog; fails_when=2P MCBs or 2P RCBOs are missing, are not 2P, or the TV/SAT aerial socket is missing; no_claim=prices
  it('offers two-pole MCBs and RCBOs and aerial sockets', () => {
    const panel = ofCategory('panel_device');
    const twoPole = (type: string) =>
      panel.filter((i) => i.attributes.panelDeviceType === type && i.attributes.poles === '2P');
    expect(twoPole('mcb').map((i) => i.attributes.ratingA)).toEqual([10, 16, 20, 25, 32, 40]);
    expect(twoPole('rcbo').map((i) => i.attributes.ratingA)).toEqual([10, 16, 20, 25, 32]);
    expect(twoPole('rcbo').every((i) => i.attributes.sensitivityMa === 30)).toBe(true);
    expect(
      ofCategory('device')
        .filter((i) => i.attributes.deviceType === 'tv')
        .map((i) => i.id),
    ).toEqual(['builtin:tv_socket', 'builtin:tv_sat_socket']);
  });
});
