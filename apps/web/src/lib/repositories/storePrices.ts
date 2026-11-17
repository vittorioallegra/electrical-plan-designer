// Prices from online stores (today: Shelly's). The desktop app asks main over `window.epd`, which
// is the only part of the app that reaches the network; in a browser (dev, browser E2E) and in
// jsdom a fake answers with fixed prices, so the flow can be tried without the network.
import type { EpdBridge, StorePrice } from '@epd/bridge/bridge';
import type { StorePrices } from './types';

export function createDesktopStorePrices(store: EpdBridge['store']): StorePrices {
  return { shellyPrices: (country, handles) => store.shellyPrices(country, [...handles]) };
}

/** Shelly's store prices with VAT on 2026-11-17 (in cents), with their codes. */
export const sampleShellyPrices: Readonly<Record<string, Omit<StorePrice, 'handle'>>> = {
  'shelly-pro-1': { status: 'ok', priceCents: 5990, sku: 'FG3800235268001' },
  'shelly-pro-1pm': { status: 'ok', priceCents: 7590, sku: 'FG3800235268018' },
  'shelly-pro-2': { status: 'ok', priceCents: 7090, sku: 'FG3800235268025' },
  'shelly-pro-2pm': { status: 'ok', priceCents: 9990, sku: 'FG3800235268032' },
  'shelly-pro-3': { status: 'ok', priceCents: 8990, sku: 'FG3800235268094' },
  'shelly-pro-4pm': { status: 'ok', priceCents: 11790, sku: 'FG3800235268049' },
  'shelly-pro-em-50': { status: 'ok', priceCents: 10190 },
  'shelly-1-gen3': { status: 'ok', priceCents: 1390, sku: 'FG3800235261767' },
  'shelly-1pm-gen3': { status: 'ok', priceCents: 1490, sku: 'FG3800235261798' },
  'shelly-1-mini-gen3': { status: 'ok', priceCents: 1390, sku: 'FG3800235261576' },
  'shelly-1pm-mini-gen3': { status: 'ok', priceCents: 1490, sku: 'FG3800235261590' },
  'shelly-2pm-gen3': { status: 'ok', priceCents: 3890, sku: 'FG3800235261910' },
};

/**
 * Answers from a fixed table (the sample prices unless given); unknown handles are `not_found`.
 * `delayMs` makes the answer take as long as a real request does (the browser build).
 */
export function createMemoryStorePrices(
  answers: Readonly<Record<string, Omit<StorePrice, 'handle'>>> = sampleShellyPrices,
  { delayMs = 0 }: { delayMs?: number } = {},
): StorePrices & { calls: { country: string; handles: string[] }[] } {
  const calls: { country: string; handles: string[] }[] = [];
  return {
    calls,
    async shellyPrices(country, handles) {
      calls.push({ country, handles: [...handles] });
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
      return handles.map((handle) => ({ handle, ...(answers[handle] ?? { status: 'not_found' }) }));
    },
  };
}
