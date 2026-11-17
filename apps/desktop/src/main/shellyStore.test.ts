import { describe, expect, it, vi } from 'vitest';
import { fetchShellyPricesWith, readProduct, shellyProductUrl, type Fetch } from './shellyStore';
import { parseShellyPricesArgs } from './ipcValidation';

const product = (price: number, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    handle: 'x',
    variants: [{ price, sku: 'FG1', available: true, ...extra }],
  });

function answer(status: number, body = '', currency = 'EUR'): Response {
  return new Response(body, {
    status,
    headers: { 'set-cookie': `cart_currency=${currency}; path=/` },
  });
}

const noPause = () => Promise.resolve();

describe('Shelly store', () => {
  // protects=main builds every URL itself; fails_when=a handle or country can change the origin or the path, or the arguments accept a country outside the euro area, a URL or too many handles; no_claim=the renderer's handle list
  it('builds URLs on the fixed origin from validated arguments only', () => {
    expect(shellyProductUrl('shelly-pro-4pm', 'IT')).toBe(
      'https://www.shelly.com/products/shelly-pro-4pm.js?country=IT',
    );
    expect(parseShellyPricesArgs(['DE', ['shelly-pro-1']])).toEqual({
      country: 'DE',
      handles: ['shelly-pro-1'],
    });
    for (const args of [
      ['US', ['shelly-pro-1']],
      ['IT', ['https://evil.example/']],
      ['IT', ['../cart']],
      ['IT', []],
      ['IT', Array.from({ length: 21 }, () => 'a')],
    ])
      expect(() => parseShellyPricesArgs(args)).toThrow();
  });

  // protects=reading a product; fails_when=raw control characters break the parse, a sold-out product loses its price, or a missing or odd price passes as one; no_claim=variants beyond the first
  it('reads the first variant leniently', () => {
    expect(readProduct('a', '{"title":"A\nB","variants":[{"price":11790,"sku":"FG1"}]}')).toEqual({
      handle: 'a',
      status: 'ok',
      priceCents: 11790,
      sku: 'FG1',
    });
    expect(readProduct('a', product(3890, { available: false, sku: '' }))).toEqual({
      handle: 'a',
      status: 'unavailable',
      priceCents: 3890,
    });
    expect(readProduct('a', product(11.9)).status).toBe('failed');
    expect(readProduct('a', '<html>').status).toBe('failed');
  });

  // protects=statuses per product; fails_when=404, network errors or a non-EUR answer are not told apart, or a 429 does not stop the run and mark the rest; no_claim=real network (fetch is stubbed)
  it('maps answers to statuses and stops at 429', async () => {
    const fetch = vi.fn<Fetch>(async (url) => {
      if (url.includes('/a.js')) return answer(200, product(11790));
      if (url.includes('/b.js')) return answer(404);
      if (url.includes('/c.js')) throw new Error('offline');
      if (url.includes('/d.js')) return answer(200, product(4615000), 'HUF');
      return answer(429);
    });
    const result = await fetchShellyPricesWith(
      fetch,
      'IT',
      ['a', 'b', 'c', 'd', 'e', 'f'],
      noPause,
    );
    expect(result.map((r) => r.status)).toEqual([
      'ok',
      'not_found',
      'failed',
      'wrong_currency',
      'rate_limited',
      'rate_limited',
    ]);
    expect(fetch).toHaveBeenCalledTimes(5);
    expect(fetch.mock.calls[0]![0]).toBe('https://www.shelly.com/products/a.js?country=IT');
  });
});
