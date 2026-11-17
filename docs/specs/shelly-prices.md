# Spec: Shelly prices from shelly.com

Status: implemented (2026-11-17); agreed with the user the same day.

## Context

The Shelly catalog (docs/specs/smart-devices.md) ships without prices, like every built-in
catalog. An electrician prices each model by hand in Settings › Catalog, and the price drifts
out of date. Shelly sells every model in its official online store at shelly.com, and the store
publishes each product's price. Fetching those prices on request saves the typing. The user
still checks and applies them.

## Findings (checked 2026-11-17)

- shelly.com runs on Shopify. Each product answers at `https://www.shelly.com/products/<handle>.js`
  (Shopify's storefront Ajax API) with JSON: `title`, `available` and `variants[]`, each variant
  with `price` in integer cents, `sku` and `available`. No key or sign-in is needed.
- Shelly does not document this endpoint as an API for third parties. The `.json` variant of
  the same URL holds raw control characters in `body_html` and fails a strict JSON parser. The
  full list (`/products.json`) answered 429 (too many requests) on the first try.
- Prices **include VAT**: the page says "Incl. VAT", and the store does not sell without VAT.
- The store takes the buyer's country as `?country=<ISO code>`. For the Pro 4PM it answered
  11790 (EUR) for IT, DE, FR and US alike, 4615000 for HU (forints) and 10000 for CH. So in
  the euro area the price with VAT is the same everywhere, and the VAT inside it is the
  buyer's country's: the net price depends on the country (€96.64 at 22% in Italy, €99.08 at
  19% in Germany).
- These are public retail prices; there is no trade price to fetch.
- Some products are packs: the Shelly 2PM Gen3 is sold only as a 2-pack (`2 pack`, €38.90).
- Handles found (the in-box models are the Gen3 products, the current line). The Pro 3EM is
  no longer in the Shelly catalog (docs/specs/smart-devices.md), so it is not fetched:

| Item (`builtin:shelly_<slug>`) | Handle | Pack | Price incl. VAT | SKU |
|---|---|---|---|---|
| `pro_1` | `shelly-pro-1` | 1 | 59.90 | FG3800235268001 |
| `pro_1pm` | `shelly-pro-1pm` | 1 | 75.90 | FG3800235268018 |
| `pro_2` | `shelly-pro-2` | 1 | 70.90 | FG3800235268025 |
| `pro_2pm` | `shelly-pro-2pm` | 1 | 99.90 | FG3800235268032 |
| `pro_3` | `shelly-pro-3` | 1 | 89.90 | FG3800235268094 |
| `pro_4pm` | `shelly-pro-4pm` | 1 | 117.90 | FG3800235268049 |
| `pro_em_50` | `shelly-pro-em-50` | 1 | 101.90 | FG3800235268148 |
| `1_gen3` | `shelly-1-gen3` | 1 | 13.90 | FG3800235261767 |
| `1pm_gen3` | `shelly-1pm-gen3` | 1 | 14.90 | FG3800235261798 |
| `1_mini_gen3` | `shelly-1-mini-gen3` | 1 | 13.90 | FG3800235261576 |
| `1pm_mini_gen3` | `shelly-1pm-mini-gen3` | 1 | 14.90 | FG3800235261590 |
| `2pm_gen3` | `shelly-2pm-gen3` | 2 | 38.90 | FG3800235261910 |

## Proposed Change

### 1. Company country

- Settings › Company gets a **Country** field, required: a `Select` of the euro-area countries
  (names from `Intl.DisplayNames` in the UI language, no new i18n keys per country) plus
  "Other country".
- Stored in the library as `company.country`: an ISO 3166-1 alpha-2 code (`IT`, `DE`, …) or
  `other`. Default `IT`, for a new library and for one migrated from version 1.
- It is the country the electrician buys in. The app uses it for the price update only; quotes
  and PDFs do not show it in this step.
- Library format: the field goes into library **version 2**, which is not released yet (it came
  with the smart devices, uncommitted). `migrateLibrary` fills `country: 'IT'` when it is
  missing. The frozen v1 fixture stays as it is, and its test now expects `country: 'IT'` after
  loading. If version 2 is released before this lands, it becomes version 3 with its own
  migration instead.
- `.epd` and `.epc` do not change: the company lives only in the library.

### 2. VAT rates

- A domain table `standardVatRates` with the standard VAT rate of each euro-area country, in
  basis points (Finland's 25.5% is 2550). Rates to confirm against the European Commission's
  table on the day of implementation:

| Country | Rate | Country | Rate | Country | Rate |
|---|---|---|---|---|---|
| AT | 20 | FI | 25.5 | LV | 21 |
| BE | 21 | FR | 20 | MT | 18 |
| BG | 20 | GR | 24 | NL | 21 |
| CY | 19 | HR | 25 | PT | 23 |
| DE | 19 | IE | 23 | SI | 22 |
| EE | 24 | IT | 22 | SK | 23 |
| ES | 21 | LT | 21 | | |
| | | LU | 17 | | |

- The rates are part of the app: if a country changes its rate, the table changes in a new
  release. A test pins the table so that a change is deliberate.
- The `Select` of countries is built from this table, so the two cannot drift apart.

### 3. Where it shows

- Settings › Catalog, sidebar: the "Shelly catalog" row gets a menu (like the imported
  catalogs) with one action, **"Update prices"** ("Aggiorna prezzi"). The generic built-in
  catalog gets no such action.
- With the company country set to "Other country" the action is disabled, with a hint: the
  app handles euro amounts only, and prices for other countries come in other currencies.
- Desktop app only. In the browser build (`pnpm dev`) the bridge fake answers with fixed data,
  for development and E2E.

### 4. Flow

1. The action opens a dialog that names the country ("Prices for Italy, VAT 22% removed") and
   fetches the 12 products from shelly.com as soon as it opens, one at a time, showing
   progress. There are no options: no VAT field, no discount.
2. Prices are asked for the company country (`?country=IT`) and turned into net prices by
   removing that country's VAT, since items and quotes hold net prices and the quote adds VAT
   on top. The quote's VAT rate is not used: it is the VAT charged to the client (10% on some
   renovations), not the VAT paid to Shelly.
3. A preview table lists each model with its current price, the new net price, the difference,
   and a status. Rows that changed are ticked; the user can untick any row.
4. "Apply" writes the ticked prices into the library's `priceOverrides`
   (`builtin:shelly_<slug>` → `{ unitPrice, code? }`; `code` only when the store's SKU differs
   from the item's built-in code), in one
   library change. A toast says how many prices were updated.
5. Projects already open or saved keep their own copies; they get the new prices through
   "Update from catalog", as for any library price.

Net price in cents: `round(price × 10000 / (packSize × (10000 + rateBp)))`.
Examples in Italy: Pro 4PM, 11790 → 9664 (€96.64); 2PM Gen3 2-pack, 3890 → 1594 (€15.94
each). In Germany: Pro 4PM → 9908 (€99.08).

### 5. Statuses per model

- `ok`: price read.
- `unavailable`: the product is sold out. The price is still shown and can be applied.
- `not_found` (404): the handle no longer exists. Not applicable. The message names the model.
- `rate_limited` (429): main stops asking, the remaining rows show this status, and the
  dialog offers "Try again" for those rows.
- `failed`: network error, timeout (10 s), or an answer that does not parse. Not applicable.
- `wrong_currency`: the answer is not in EUR (`currency` in the response, when present, or a
  price far from the others). Not applicable. Guards against the store changing a country's
  market.

### 6. Main process and bridge

- New bridge method `catalog.fetchShellyPrices(country: string, handles: string[])` returning
  per handle `{ handle, status, priceCents?, currency?, sku?, available? }`. IPC input is
  validated like the other channels (`ipcValidation.ts`): `country` is one of the table's codes,
  at most 20 handles, each `^[a-z0-9-]{1,80}$`.
- Main builds every URL itself on the fixed origin
  `https://www.shelly.com/products/<handle>.js?country=<code>`.
  The renderer never sends a URL. Requests use Electron's `net.fetch` with a generic
  user agent, no cookies (no session shared with the window), one at a time with ~500 ms in
  between.
- The renderer CSP (`connect-src`) does not change: the window still cannot reach the network.
- Responses are parsed leniently (raw control characters) and checked with a zod schema. Only
  the first variant's `price`, `sku` and `available` are used.

### 7. Domain

- The mapping (item id → handle, pack size) lives next to the Shelly items in
  `catalog/builtin.ts` (or `catalog/shellyStore.ts`), with a test that every Shelly item has
  one.
- A pure function computes the net price (country VAT, pack size, rounding) and one builds
  the preview rows from current overrides and fetch results.
- `priceOverrides` already holds `unitPrice` and `code`; the only format change is the company
  country (section 1).

## Testing

- Domain: net price maths (22%, 19%, 25.5%, 2-pack, rounding), preview rows (unchanged,
  changed, new, statuses), mapping covers every Shelly item, the VAT table is pinned, the
  company schema accepts a table code or `other` and nothing else, a v1 library loads with
  `country: 'IT'`.
- Desktop main: URL built only from a valid handle and country on the fixed origin; a
  country outside the table is refused; 404, 429 (stops the
  rest), timeout and broken JSON map to their statuses; `net.fetch` is stubbed (no real
  network in tests).
- Web: Company page saves the country; dialog flow with the bridge fake: fetch on open,
  untick a row, apply, overrides written with the SKU, toast; `not_found` rows cannot be
  applied; with "Other country" the action is disabled with its hint.
- Browser E2E: open the Shelly catalog menu, update prices, see the prices in the table.
- No test calls shelly.com. A manual check against the real store is part of the release.

## Out of scope

- Automatic or scheduled updates. The app only goes online when the user asks.
- Other stores, distributors or brands. Distributor lists keep using the CSV import.
- Countries outside the euro area, and any currency other than EUR (the app's money is EUR
  only).
- Reduced VAT rates: Shelly devices take the standard rate.
- Showing the country on quotes and PDFs.
- Fetching specifications (widths, channels) from the store.

## Decisions (2026-11-17)

- VAT: the VAT of the company's country is removed automatically (22% in Italy); there is no
  way to buy without VAT.
- The company gets a Country field (euro-area countries or "Other country"), default Italy.
- No discount or other options in the dialog.
- The action is called "Update prices" ("Aggiorna prezzi").
- The Pro 3EM leaves the Shelly catalog (two versions, three-phase).

## Open questions

- Shelly's terms of use were not checked. The data is served publicly by Shopify's storefront
  Ajax API and 12 requests on demand are light, but read the terms before release.
