import type { Chain, Network } from './market'

export type ChartInterval = 'hour' | 'day' | 'week'
export type ChartPoint = {
  timestamp: string
  endsAt: string
  launchCount: number
  tradeCount: number
  buyCount: number
  sellCount: number
  volume: string
  participantCount: number
}
export type ChartGroup = { chain: Chain; network: Network; items: ChartPoint[] }
export type ChartResult = {
  currency: 'USDC'
  multiplier: 2
  asOf: string
  from: string
  to: string
  interval: ChartInterval
  timezone: 'UTC'
  chains: ChartGroup[]
  combined: ChartGroup[]
}

export type ChartMetric = 'launchCount' | 'tradeCount' | 'buyCount' | 'sellCount' | 'volume' | 'participantCount'
export const CHART_METRICS: { key: ChartMetric; label: string; kind: 'count' | 'volume'; help: string }[] = [
  { key: 'launchCount', label: 'New launches', kind: 'count', help: 'Launches created within each bucket' },
  { key: 'tradeCount', label: 'Trades', kind: 'count', help: 'Buys and sells within each bucket' },
  { key: 'buyCount', label: 'Buys', kind: 'count', help: 'Buy trades within each bucket' },
  { key: 'sellCount', label: 'Sells', kind: 'count', help: 'Sell trades within each bucket' },
  { key: 'volume', label: 'Trading volume', kind: 'volume', help: 'Reported gross buy and sell volume per bucket' },
  { key: 'participantCount', label: 'Unique trading wallets', kind: 'count', help: 'Distinct wallets per bucket; not additive across buckets' },
]
export const CHART_INTERVALS: { key: ChartInterval; label: string }[] = [
  { key: 'hour', label: 'Hourly' },
  { key: 'day', label: 'Daily' },
  { key: 'week', label: 'Weekly' },
]

export const MAX_CHART_RANGE_DAYS = 366
export const MAX_CHART_BUCKETS = 1000
const BUCKET_MS: Record<ChartInterval, number> = { hour: 3_600_000, day: 86_400_000, week: 604_800_000 }

// Groups are addressed by chain/network, never by array position.
export function selectChartGroup(result: ChartResult, chain: Chain, network: Network): ChartGroup | undefined {
  return (chain === 'all' ? result.combined : result.chains).find(group => group.chain === chain && group.network === network)
}

// Resolves the requested UTC day range into ISO bounds: from inclusive at 00:00,
// to exclusive at the next midnight, clamped to now because `to` cannot be future.
export function chartRange(fromDay: string, toDay: string, now: Date = new Date()): { from: string; to: string } {
  const day = /^\d{4}-\d{2}-\d{2}$/
  if (!day.test(fromDay) || !day.test(toDay)) throw new RangeError('Choose both a start and an end date.')
  const from = Date.parse(`${fromDay}T00:00:00.000Z`)
  const end = Date.parse(`${toDay}T00:00:00.000Z`) + 86_400_000
  if (Number.isNaN(from) || Number.isNaN(end)) throw new RangeError('Choose valid calendar dates.')
  if (from >= end) throw new RangeError('The start date must be before the end date.')
  if (end - from > MAX_CHART_RANGE_DAYS * 86_400_000) throw new RangeError(`The range is limited to ${MAX_CHART_RANGE_DAYS} days.`)
  return { from: new Date(from).toISOString(), to: new Date(Math.min(end, now.getTime())).toISOString() }
}

export function checkChartBuckets(from: string, to: string, interval: ChartInterval) {
  const buckets = Math.ceil((Date.parse(to) - Date.parse(from)) / BUCKET_MS[interval])
  if (buckets > MAX_CHART_BUCKETS) {
    throw new RangeError(`This range needs more than ${MAX_CHART_BUCKETS} ${interval} buckets. Shorten the range or pick a wider interval.`)
  }
}

export function chartQuery(options: { interval?: ChartInterval; from?: string; to?: string }): string {
  const params = new URLSearchParams()
  if (options.interval) params.set('interval', options.interval)
  if (options.from) params.set('from', options.from)
  if (options.to) params.set('to', options.to)
  return params.toString()
}

// Reject malformed payloads instead of rendering misleading partial statistics.
export function isChartResult(value: unknown): value is ChartResult {
  const object = (item: unknown): item is Record<string, unknown> => !!item && typeof item === 'object'
  const count = (item: unknown) => typeof item === 'number' && Number.isSafeInteger(item) && item >= 0
  const point = (item: unknown): boolean => object(item) && typeof item.timestamp === 'string' && typeof item.endsAt === 'string'
    && count(item.launchCount) && count(item.tradeCount) && count(item.buyCount) && count(item.sellCount)
    && typeof item.volume === 'string' && /^\d+(\.\d+)?$/.test(item.volume) && count(item.participantCount)
  const group = (item: unknown): boolean => object(item) && (item.chain === 'all' || item.chain === 'stellar' || item.chain === 'base')
    && (item.network === 'public' || item.network === 'testnet') && Array.isArray(item.items) && item.items.every(point)
  return object(value) && value.currency === 'USDC' && value.multiplier === 2 && value.timezone === 'UTC'
    && typeof value.asOf === 'string' && typeof value.from === 'string' && typeof value.to === 'string'
    && (value.interval === 'hour' || value.interval === 'day' || value.interval === 'week')
    && Array.isArray(value.chains) && value.chains.every(group) && Array.isArray(value.combined) && value.combined.every(group)
}
