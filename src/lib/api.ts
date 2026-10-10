import { isMarketStats } from './market'
import type { MarketStats } from './market'
import { isChartResult, chartQuery } from './chart'
import type { ChartInterval, ChartResult } from './chart'
import { isTradesResult, tradesQuery } from './trades'
import type { TradesResult } from './trades'

// Adapted from lumenrise-interface/src/lib/api/client.ts: /v1 URL and envelope conventions.
// This public analytics app has no wallet/authentication dependencies or network headers.
export class ApiError extends Error {
  readonly status?: number
  constructor(message: string, status?: number) { super(message); this.name = 'ApiError'; this.status = status }
}
export function apiUrl(baseUrl: string, path: string) {
  const base = baseUrl.trim().replace(/\/+$/, '')
  return `${base.endsWith('/v1') ? base : `${base}/v1`}${path}`
}
export async function apiRequest<T>(path: string, signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(15_000)
  let response: Response
  try {
    // Vite proxies local requests to the configured API, avoiding cross-origin fetches.
    const baseUrl = import.meta.env.DEV ? '' : import.meta.env.VITE_API_BASE_URL ?? ''
    response = await fetch(apiUrl(baseUrl, path), {
      method: 'GET', credentials: 'omit', signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new ApiError(timeout.aborted ? 'The request timed out. Please try again.' : 'Could not reach the server. Check your connection and try again.')
  }
  let envelope
  try { envelope = await response.json() } catch { throw new ApiError('The server returned an invalid response. Please try again.', response.status) }
  if (!response.ok || envelope?.status !== 'success') {
    throw new ApiError(typeof envelope?.message === 'string' ? envelope.message : 'Unable to load statistics. Please try again.', response.status)
  }
  return envelope.result as T
}
export async function getMarketStats(signal?: AbortSignal): Promise<MarketStats> {
  const result = await apiRequest<unknown>('/stats/market', signal)
  if (!isMarketStats(result)) throw new ApiError('The server returned invalid market statistics. Please try again.')
  return result
}

// Public trade feed. Cursor map keys are the group cursor parameters
// (stellarTestnetCursor, combinedPublicCursor, ...); omitted groups return first pages.
export async function getTrades(
  options: { limit?: number; cursors?: Record<string, string | null | undefined> } = {},
  signal?: AbortSignal,
): Promise<TradesResult> {
  const result = await apiRequest<unknown>(`/stats/trades?${tradesQuery(options.limit, options.cursors)}`, signal)
  if (!isTradesResult(result)) throw new ApiError('The server returned invalid trade statistics. Please try again.')
  return result
}

// Public analytics chart. Omitting options uses the server default (daily, last 30 days).
export async function getChart(
  options: { interval?: ChartInterval; from?: string; to?: string } = {},
  signal?: AbortSignal,
): Promise<ChartResult> {
  const query = chartQuery(options)
  const result = await apiRequest<unknown>(`/stats/chart${query ? `?${query}` : ''}`, signal)
  if (!isChartResult(result)) throw new ApiError('The server returned invalid chart statistics. Please try again.')
  return result
}

// HTTP 400 means the request configuration is invalid; HTTP 503 means temporary unavailability.
export function describeApiError(reason: unknown): string {
  if (reason instanceof ApiError) {
    if (reason.status === 503) return `Statistics are temporarily unavailable. ${reason.message}`
    if (reason.status === 400) return `Invalid request configuration. ${reason.message}`
    return reason.message
  }
  return reason instanceof Error ? reason.message : 'Unable to load statistics.'
}
