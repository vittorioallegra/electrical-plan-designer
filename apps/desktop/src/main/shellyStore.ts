// Prices from Shelly's online store (docs/specs/shelly-prices.md). Main builds every URL on a
// fixed origin from a validated handle and country; the window itself never reaches the network.
// Requests go through their own in-memory session: no cookies, no cache, nothing shared with the
// window's session (which blocks every foreign request in production).
import type { StorePrice } from '@epd/bridge/bridge';
import type { EuroCountry } from '@epd/domain/vatRates';

export const SHELLY_STORE_ORIGIN = 'https://www.shelly.com';
const TIMEOUT_MS = 10_000;
const PAUSE_MS = 500;

export type Fetch = (url: string, init: { signal: AbortSignal }) => Promise<Response>;

export function shellyProductUrl(handle: string, country: EuroCountry): string {
  return `${SHELLY_STORE_ORIGIN}/products/${encodeURIComponent(handle)}.js?country=${country}`;
}

/** Reads one product answer: the first variant's price, code and availability. */
export function readProduct(handle: string, body: string): StorePrice {
  let product: unknown;
  try {
    // The store's JSON may hold raw control characters in descriptions: drop them first.
    // eslint-disable-next-line no-control-regex
    product = JSON.parse(body.replace(/[\u0000-\u001f]+/g, ' '));
  } catch {
    return { handle, status: 'failed' };
  }
  const variant = (product as { variants?: unknown[] } | null)?.variants?.[0] as
    { price?: unknown; sku?: unknown; available?: unknown } | undefined;
  const price = variant?.price;
  if (typeof price !== 'number' || !Number.isInteger(price) || price <= 0)
    return { handle, status: 'failed' };
  const sku =
    typeof variant?.sku === 'string' && variant.sku ? variant.sku.slice(0, 64) : undefined;
  return {
    handle,
    status: variant?.available === false ? 'unavailable' : 'ok',
    priceCents: price,
    ...(sku ? { sku } : {}),
  };
}

/**
 * Asks for each product in turn. A 429 stops the run: that product and the rest come back
 * `rate_limited`. Prices outside EUR come back `wrong_currency` (the store answers in the
 * country's currency).
 */
export async function fetchShellyPricesWith(
  fetch: Fetch,
  country: EuroCountry,
  handles: readonly string[],
  pause: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<StorePrice[]> {
  const results: StorePrice[] = [];
  for (const [index, handle] of handles.entries()) {
    if (index > 0) await pause(PAUSE_MS);
    let response: Response;
    try {
      response = await fetch(shellyProductUrl(handle, country), {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      results.push({ handle, status: 'failed' });
      continue;
    }
    if (response.status === 429) {
      results.push(
        ...handles.slice(index).map((h) => ({ handle: h, status: 'rate_limited' as const })),
      );
      break;
    }
    if (response.status === 404) {
      results.push({ handle, status: 'not_found' });
      continue;
    }
    if (!response.ok) {
      results.push({ handle, status: 'failed' });
      continue;
    }
    const currency = currencyCookie(response);
    let body: string;
    try {
      body = await response.text();
    } catch {
      results.push({ handle, status: 'failed' });
      continue;
    }
    const price = readProduct(handle, body);
    results.push(
      currency && currency !== 'EUR' && price.priceCents !== undefined
        ? { handle, status: 'wrong_currency' }
        : price,
    );
  }
  return results;
}

/** Shopify names the currency of the answer in its `cart_currency` cookie (EUR, HUF, CHF…). */
function currencyCookie(response: Response): string | null {
  const cookies = response.headers.get('set-cookie') ?? '';
  return /(?:^|[;,\s])cart_currency=([A-Z]{3})/.exec(cookies)?.[1] ?? null;
}

/** The store prices through Electron's network stack, in a session of their own. */
export async function fetchShellyPrices(
  country: EuroCountry,
  handles: readonly string[],
): Promise<StorePrice[]> {
  const { session } = await import('electron');
  const store = session.fromPartition('shelly-store', { cache: false });
  store.setUserAgent('ElectricalPlanDesigner');
  return fetchShellyPricesWith(
    (url, init) => store.fetch(url, { ...init, credentials: 'omit', cache: 'no-store' }),
    country,
    handles,
  );
}
