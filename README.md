# LumenRise Analytics

Lightweight React + TypeScript dashboard using the LumenRise interface brand tokens, logo and locally hosted fonts. No authentication or wallet dependencies.

## Run

```sh
npm install
npm run dev
```

The dashboard opens automatically at http://127.0.0.1:5180/. Keep the terminal running. This project uses a fixed port to avoid collisions with other local Vite apps; if port 5180 is already occupied, stop the previous analytics server before restarting.

Copy `.env.example` to `.env.local` (or `.env`) and set `VITE_API_BASE_URL` to your API origin (with or without `/v1`). During `npm run dev`, Vite proxies same-origin `/v1` requests to this backend, so local development does not require backend CORS configuration. Leave the value empty when the API is already served on the same origin. Production builds use the configured URL directly; the backend must allow the frontend origin through CORS when hosted separately. Restart Vite after changing environment values.

## Statistics

The public GET has no parameters or authentication. The network filter selects the combined Stellar + Base group locally, with launches in one alphabetical list; `public` is labeled Mainnet. Launches are selected by chain, network and contract ID. Amounts are whole USDC decimal strings and rounded to at most three decimals for display using exact integer arithmetic, without floating-point conversion, rescaling or multiplication. The original API amounts remain unchanged. Wallet and global user counts come directly from the selected server group.

Refresh and retry fetch a new response; the server caches responses for 10 seconds. The page shows the server's `asOf` timestamp in the viewer's local timezone. Statistics reflect indexed trading history, not current holdings. Loading, missing-group, no-launch and retryable error states are supported, including temporary HTTP 503 failures.

## Trades

The public GET `/v1/stats/trades` feed accepts `limit` (1–100, default 20) plus one cursor parameter per group (`stellarTestnetCursor`, `stellarPublicCursor`, `baseTestnetCursor`, `basePublicCursor`, `combinedTestnetCursor`, `combinedPublicCursor`). Pages are selected by chain/network, never by array position. Each group paginates independently: "Load more" sends only that group's cursor, appends only that group's items and deduplicates by trade `id`, stopping at `hasMore=false` or a null cursor. Quantity, price and value are already normalized decimal strings (whole tokens, USDC per token, gross USDC) and are rendered through the same exact-arithmetic formatting without rescaling or multiplication. Rows link to the launch by slug with its chain/network. Trade responses are cached for 5 seconds.

## Activity chart

The public GET `/v1/stats/chart` endpoint takes `interval` (hour/day/week, default day) and ISO 8601 `from` (inclusive) / `to` (exclusive, never future) bounds, defaulting to the last 30 days, with a 366-day and 1000-bucket ceiling. The UI offers chain, network, metric (launches, trades, buys, sells, volume, unique wallets), interval and UTC day-range controls, validating the range locally before requesting. Buckets are ascending, zero-filled, non-cumulative UTC intervals; first and last buckets may be clipped to the range. Bucket wallet counts are distinct per bucket and are never summed into range totals. Chart responses are cached for 10 seconds.

Both endpoints treat HTTP 400 as an invalid request configuration and HTTP 503 as temporary unavailability with retry. They report indexed launch/trade activity, not website visits.

## Verify

```sh
npm run build
npm run lint
npm test
```

Tests require Node 24+ (native TypeScript stripping). Browser QA used intercepted API fixtures to check desktop/mobile, loading, empty, 503/retry, filters and per-launch details. A live backend is required to verify deployment connectivity.

