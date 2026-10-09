import assert from 'node:assert/strict'
import test from 'node:test'
import { CHART_METRICS, chartQuery, chartRange, checkChartBuckets, isChartResult, selectChartGroup } from '../src/lib/chart.ts'
const point = timestamp => ({ timestamp, endsAt: '2026-11-02T00:00:00Z', launchCount: 1, tradeCount: 4, buyCount: 3, sellCount: 1, volume: '9007199254740993.123456', participantCount: 2 })
const group = (chain, network) => ({ chain, network, items: [point('2026-11-01T00:00:00Z')] })
const result = { currency: 'USDC', multiplier: 2, asOf: '2026-11-01T10:00:00Z', from: '2026-10-02T00:00:00Z', to: '2026-11-01T00:00:00Z', interval: 'day', timezone: 'UTC', chains: [group('base', 'public'), group('stellar', 'testnet'), group('stellar', 'public'), group('base', 'testnet')], combined: [group('all', 'testnet'), group('all', 'public')] }
test('exposes the six selectable metrics', () => {
  assert.deepEqual(CHART_METRICS.map(metric => metric.key), ['launchCount', 'tradeCount', 'buyCount', 'sellCount', 'volume', 'participantCount'])
  assert.equal(CHART_METRICS.find(metric => metric.key === 'volume').kind, 'volume')
})
test('selects shuffled groups by chain/network, not position', () => {
  assert.equal(selectChartGroup(result, 'base', 'public'), result.chains[0])
  assert.equal(selectChartGroup(result, 'all', 'testnet'), result.combined[0])
  assert.equal(selectChartGroup({ ...result, chains: [] }, 'stellar', 'public'), undefined)
})
test('resolves UTC day ranges with an exclusive clamped end', () => {
  const now = new Date('2026-11-01T12:00:00Z')
  assert.deepEqual(chartRange('2026-10-02', '2026-10-31', now), { from: '2026-10-02T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' })
  assert.equal(chartRange('2026-11-01', '2026-11-01', now).to, now.toISOString())
  assert.throws(() => chartRange('2026-11-01', '2026-10-01', now), /before the end/)
  assert.throws(() => chartRange('2024-01-01', '2026-11-01', now), /366 days/)
  assert.throws(() => chartRange('not-a-date', '2026-11-01', now), RangeError)
})
test('rejects ranges that exceed the bucket limit', () => {
  assert.doesNotThrow(() => checkChartBuckets('2026-10-02T00:00:00Z', '2026-11-01T00:00:00Z', 'day'))
  assert.throws(() => checkChartBuckets('2026-06-01T00:00:00Z', '2026-11-01T00:00:00Z', 'hour'), /wider interval/)
})
test('builds the chart query and defaults to the server range', () => {
  assert.equal(chartQuery({}), '')
  const query = new URLSearchParams(chartQuery({ interval: 'week', from: '2026-10-02T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' }))
  assert.equal(query.get('interval'), 'week')
  assert.equal(query.get('from'), '2026-10-02T00:00:00.000Z')
})
test('accepts valid results and rejects malformed payloads', () => {
  assert.equal(isChartResult(result), true)
  assert.equal(isChartResult({ ...result, chains: [], combined: [] }), true)
  assert.equal(isChartResult({ ...result, interval: 'month' }), false)
  assert.equal(isChartResult({ ...result, timezone: 'PST' }), false)
  assert.equal(isChartResult({ ...result, chains: [{ chain: 'base', network: 'public', items: 'nope' }] }), false)
  assert.equal(isChartResult({ ...result, combined: [{ ...group('all', 'public'), items: [{ ...point('2026-11-01T00:00:00Z'), volume: -1 }] }] }), false)
  assert.equal(isChartResult({ ...result, combined: [{ ...group('all', 'public'), items: [{ ...point('2026-11-01T00:00:00Z'), participantCount: 1.5 }] }] }), false)
})
