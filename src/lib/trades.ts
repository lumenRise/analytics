import type { Chain, Network } from './market';

export type TradeSide = 'buy' | 'sell';
export type TradeLaunch = {
  slug: string;
  name: string;
  symbol: string;
  logo: string;
};
export type TradeItem = {
  id: string;
  hash?: string;
  chain: Exclude<Chain, 'all'>;
  network: Network;
  launch: TradeLaunch;
  trader: string;
  tradedAt: string;
  side: TradeSide;
  assetAmount: string;
  price: string;
  amount: string;
};
export type TradePage = {
  chain: Chain;
  network: Network;
  asOf: string;
  items: TradeItem[];
  hasMore: boolean;
  nextCursor: string | null;
};
export type TradesResult = {
  currency: 'USDC';
  limit: number;
  chains: TradePage[];
  combined: TradePage[];
};

export const TRADE_PAGE_LIMIT = 20;

// Groups are addressed by chain/network, never by array position.
export const tradeGroupKey = (chain: Chain, network: Network) =>
  `${chain}:${network}`;

export const TRADE_CURSOR_PARAMS: Record<string, string> = {
  [tradeGroupKey('stellar', 'testnet')]: 'stellarTestnetCursor',
  [tradeGroupKey('stellar', 'public')]: 'stellarPublicCursor',
  [tradeGroupKey('base', 'testnet')]: 'baseTestnetCursor',
  [tradeGroupKey('base', 'public')]: 'basePublicCursor',
  [tradeGroupKey('all', 'testnet')]: 'combinedTestnetCursor',
  [tradeGroupKey('all', 'public')]: 'combinedPublicCursor',
};
export function tradeCursorParam(chain: Chain, network: Network): string {
  const param = TRADE_CURSOR_PARAMS[tradeGroupKey(chain, network)];
  if (!param) throw new RangeError(`Unknown trade group: ${chain}/${network}`);
  return param;
}

// Builds the query string: clamped limit plus only the cursors that were provided.
export function tradesQuery(
  limit: number = TRADE_PAGE_LIMIT,
  cursors: Record<string, string | null | undefined> = {},
): string {
  const params = new URLSearchParams();
  params.set(
    'limit',
    String(Math.min(100, Math.max(1, Math.trunc(limit) || TRADE_PAGE_LIMIT))),
  );
  for (const [name, cursor] of Object.entries(cursors))
    if (cursor) params.set(name, cursor);
  return params.toString();
}

export function selectTradePage(
  result: TradesResult,
  chain: Chain,
  network: Network,
): TradePage | undefined {
  return (chain === 'all' ? result.combined : result.chains).find(
    (page) => page.chain === chain && page.network === network,
  );
}

// Appends one group's next page, deduplicating by id; items stay newest first.
export function mergeTradeItems(
  existing: TradeItem[],
  page: TradeItem[],
): TradeItem[] {
  const seen = new Set(existing.map((item) => item.id));
  return [...existing, ...page.filter((item) => !seen.has(item.id))];
}

// Project navigation uses the platform's combined chain/network identifier.
export function launchHref(
  trade: Pick<TradeItem, 'chain' | 'network'> & {
    launch: Pick<TradeLaunch, 'slug'>;
  },
): string {
  const network = trade.network === 'public'
    ? `${trade.chain}-mainnet`
    : trade.chain === 'base' ? 'base-sepolia' : 'stellar-testnet';
  const params = new URLSearchParams({ network });
  return `https://platform.lumenrise.app/projects/${encodeURIComponent(trade.launch.slug)}?${params}`;
}

export type LaunchTradeSummary = {
  key: string;
  launch: TradeLaunch;
  chain: TradeItem['chain'];
  network: Network;
  volume: string;
  trades: number;
  buyVolume: string;
  share: number;
};
export type TradeSummary = {
  volume: string;
  buyVolume: string;
  sellVolume: string;
  netFlow: string;
  trades: number;
  buys: number;
  sells: number;
  wallets: number;
  averageSize: string;
  largest: TradeItem | null;
  buyVolumeShare: number;
  buyCountShare: number;
  from: string | null;
  to: string | null;
  launches: LaunchTradeSummary[];
};

// Exact decimal arithmetic on USDC strings: every value is scaled to the widest fraction seen.
const toUnits = (value: string, scale: number) => {
  const [whole, fraction = ''] = value.split('.');
  return (
    BigInt(whole) * 10n ** BigInt(scale) +
    BigInt(fraction.padEnd(scale, '0') || '0')
  );
};
const fromUnits = (units: bigint, scale: number): string => {
  const sign = units < 0n ? '-' : '';
  const digits = (units < 0n ? -units : units)
    .toString()
    .padStart(scale + 1, '0');
  if (scale === 0) return sign + digits;
  const fraction = digits.slice(-scale).replace(/0+$/, '');
  return sign + digits.slice(0, -scale) + (fraction ? `.${fraction}` : '');
};
// Shares are display-only percentages with one decimal.
const share = (part: bigint, total: bigint) =>
  total > 0n ? Number((part * 1000n) / total) / 10 : 0;

// Summarizes only the trades that are loaded, never the full indexed history.
export function summarizeTrades(items: TradeItem[]): TradeSummary {
  const scale = Math.max(
    0,
    ...items.map((item) => item.amount.split('.')[1]?.length ?? 0),
  );
  let buy = 0n,
    sell = 0n,
    buys = 0,
    largestUnits = -1n;
  let largest: TradeItem | null = null;
  let from: number | null = null,
    to: number | null = null;
  const wallets = new Set<string>();
  const launches = new Map<
    string,
    {
      launch: TradeLaunch;
      chain: TradeItem['chain'];
      network: Network;
      volume: bigint;
      buy: bigint;
      trades: number;
    }
  >();
  for (const item of items) {
    const units = toUnits(item.amount, scale);
    if (item.side === 'buy') {
      buy += units;
      buys++;
    } else sell += units;
    if (units > largestUnits) {
      largestUnits = units;
      largest = item;
    }
    wallets.add(`${item.chain}:${item.trader}`);
    const time = Date.parse(item.tradedAt);
    if (!Number.isNaN(time)) {
      from = from === null ? time : Math.min(from, time);
      to = to === null ? time : Math.max(to, time);
    }
    const key = JSON.stringify([item.chain, item.network, item.launch.slug]);
    const entry = launches.get(key) ?? {
      launch: item.launch,
      chain: item.chain,
      network: item.network,
      volume: 0n,
      buy: 0n,
      trades: 0,
    };
    entry.volume += units;
    entry.trades++;
    if (item.side === 'buy') entry.buy += units;
    launches.set(key, entry);
  }
  const total = buy + sell;
  return {
    volume: fromUnits(total, scale),
    buyVolume: fromUnits(buy, scale),
    sellVolume: fromUnits(sell, scale),
    netFlow: fromUnits(buy - sell, scale),
    trades: items.length,
    buys,
    sells: items.length - buys,
    wallets: wallets.size,
    averageSize: fromUnits(
      items.length ? total / BigInt(items.length) : 0n,
      scale,
    ),
    largest,
    buyVolumeShare: share(buy, total),
    buyCountShare: items.length
      ? Math.round((buys / items.length) * 1000) / 10
      : 0,
    from: from === null ? null : new Date(from).toISOString(),
    to: to === null ? null : new Date(to).toISOString(),
    launches: [...launches.entries()]
      .sort(([, a], [, b]) =>
        b.volume > a.volume
          ? 1
          : b.volume < a.volume
            ? -1
            : b.trades - a.trades,
      )
      .map(([key, entry]) => ({
        key,
        launch: entry.launch,
        chain: entry.chain,
        network: entry.network,
        volume: fromUnits(entry.volume, scale),
        trades: entry.trades,
        buyVolume: fromUnits(entry.buy, scale),
        share: share(entry.volume, total),
      })),
  };
}
// Reject malformed payloads instead of rendering misleading partial statistics.
export function isTradesResult(value: unknown): value is TradesResult {
  const object = (item: unknown): item is Record<string, unknown> =>
    !!item && typeof item === 'object';
  const decimal = (item: unknown) =>
    typeof item === 'string' && /^\d+(\.\d+)?$/.test(item);
  const network = (item: unknown) => item === 'public' || item === 'testnet';
  const launch = (item: unknown): boolean =>
    object(item) &&
    typeof item.slug === 'string' &&
    typeof item.name === 'string' &&
    typeof item.symbol === 'string' &&
    typeof item.logo === 'string';
  const trade = (item: unknown): boolean =>
    object(item) &&
    typeof item.id === 'string' &&
    (item.chain === 'stellar' || item.chain === 'base') &&
    network(item.network) &&
    (item.hash === undefined || typeof item.hash === 'string') &&
    launch(item.launch) &&
    typeof item.trader === 'string' &&
    typeof item.tradedAt === 'string' &&
    (item.side === 'buy' || item.side === 'sell') &&
    decimal(item.assetAmount) &&
    decimal(item.price) &&
    decimal(item.amount);
  const page = (item: unknown): boolean =>
    object(item) &&
    (item.chain === 'all' ||
      item.chain === 'stellar' ||
      item.chain === 'base') &&
    network(item.network) &&
    typeof item.asOf === 'string' &&
    Array.isArray(item.items) &&
    item.items.every(trade) &&
    typeof item.hasMore === 'boolean' &&
    (item.nextCursor === null || typeof item.nextCursor === 'string');
  return (
    object(value) &&
    value.currency === 'USDC' &&
    typeof value.limit === 'number' &&
    Number.isSafeInteger(value.limit) &&
    value.limit >= 1 &&
    value.limit <= 100 &&
    Array.isArray(value.chains) &&
    value.chains.every(page) &&
    Array.isArray(value.combined) &&
    value.combined.every(page)
  );
}

// Temporary preview hash until the API contract is finalized; never use the internal id.
export const SAMPLE_TRANSACTION_HASH = '0123456789abcdef'.repeat(4);
export function displayTradeHash(
  trade: Pick<TradeItem, 'hash' | 'chain'>,
): string {
  return (
    trade.hash?.trim() ||
    (trade.chain === 'base' ? '0x' : '') + SAMPLE_TRANSACTION_HASH
  );
}
export function transactionHref(
  trade: Pick<TradeItem, 'hash' | 'chain' | 'network'>,
): string {
  const hash = encodeURIComponent(displayTradeHash(trade));
  if (trade.chain === 'base')
    return `https://${trade.network === 'testnet' ? 'sepolia.' : ''}basescan.org/tx/${hash}`;
  return `https://stellar.expert/explorer/${trade.network}/tx/${hash}`;
}
