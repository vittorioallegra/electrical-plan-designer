import { describe, expect, it } from 'vitest';
import { builtinCatalog, builtinCatalogs } from './builtin';

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

  // protects=built-in Shelly models; fails_when=a Pro model is missing, is not on the DIN rail or lacks its width, or an in-box model takes plate modules, or a model lacks its own store code; no_claim=widths beyond Shelly's datasheets
  it('offers Shelly Pro models on the rail and in-box models without modules', () => {
    const smart = ofCategory('smart_device');
    const din = smart.filter((i) => i.attributes.smartMount === 'din');
    const box = smart.filter((i) => i.attributes.smartMount === 'box');
    expect(din.map((i) => [i.id.replace('builtin:shelly_', ''), i.modules])).toEqual([
      ['pro_1', 1],
      ['pro_1pm', 1],
      ['pro_2', 1],
      ['pro_2pm', 1],
      ['pro_3', 3],
      ['pro_4pm', 3],
      ['pro_em_50', 1],
    ]);
    expect(box.map((i) => i.id.replace('builtin:shelly_', ''))).toEqual([
      '1_gen3',
      '1pm_gen3',
      '1_mini_gen3',
      '1pm_mini_gen3',
      '2pm_gen3',
    ]);
    expect(box.every((i) => i.modules === undefined)).toBe(true);
    expect(din.length + box.length).toBe(smart.length);
    expect(smart.every((i) => /^FG\d{13}$/.test(i.code ?? ''))).toBe(true);
    expect(new Set(smart.map((i) => i.code)).size).toBe(smart.length);
  });

  // protects=the Shelly catalog of its own; fails_when=a Shelly model sits in the generic built-in catalog, the Shelly catalog holds anything else, or an item belongs to no built-in catalog; no_claim=how Settings shows them (web tests)
  it('keeps the Shelly models in a built-in catalog of their own', () => {
    const [generic, shelly] = builtinCatalogs;
    expect(shelly!.items.map((i) => i.id)).toEqual(ofCategory('smart_device').map((i) => i.id));
    expect(generic!.items.some((i) => i.category === 'smart_device')).toBe(false);
    expect(builtinCatalogs.flatMap((c) => c.items)).toEqual(builtinCatalog);
  });
});
