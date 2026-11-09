import { describe, expect, it } from 'vitest';
import { builtinCatalog } from './builtin';

const ofCategory = (category: string) => builtinCatalog.filter((i) => i.category === category);

describe('built-in catalog', () => {
  // protects=plates match the built-in boxes; fails_when=a plate size has no built-in wall box or a wall box has no plate; no_claim=user catalogs
  it('has exactly one plate per built-in wall box size', () => {
    const boxSizes = ofCategory('box').map((b) => b.modules);
    expect(ofCategory('plate').map((p) => p.modules)).toEqual(boxSizes);
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
