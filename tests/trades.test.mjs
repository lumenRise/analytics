import assert from 'node:assert/strict'
import test from 'node:test'
import { TRADE_CURSOR_PARAMS, isTradesResult, launchHref, mergeTradeItems, selectTradePage, summarizeTrades, tradeCursorParam, tradeGroupKey, tradesQuery } from '../src/lib/trades.ts'
const trade = (id, overrides = {}) => ({ id, chain: 'stellar', network: 'public', launch: { slug: 'rise', name: 'Rise', symbol: 'RISE', logo: 'https://example.test/logo.png' }, trader: 'GABCDEF', tradedAt: '2026-11-01T09:00:00Z', side: 'buy', assetAmount: '1250.5', price: '0.0421', amount: '52.65605', ...overrides })
const page = (chain, network, items = [trade(`${chain}-${network}-1`)]) => ({ chain, network, asOf: '2026-11-01T10:00:00Z', items, hasMore: true, nextCursor: `cursor-${chain}-${network}` })
const result = { currency: 'USDC', limit: 20, chains: [page('base', 'public'), page('stellar', 'testnet'), page('stellar', 'public'), page('base', 'testnet')], combined: [page('all', 'testnet'), page('all', 'public')] }
test('maps every group to its cursor parameter', () => {
  assert.deepEqual({ ...TRADE_CURSOR_PARAMS }, {
    'stellar:testnet': 'stellarTestnetCursor',
    'stellar:public': 'stellarPublicCursor',
    'base:testnet': 'baseTestnetCursor',
    'base:public': 'basePublicCursor',
    'all:testnet': 'combinedTestnetCursor',
    'all:public': 'combinedPublicCursor',
  })
  assert.equal(tradeCursorParam('all', 'public'), 'combinedPublicCursor')
  assert.equal(tradeCursorParam('base', 'testnet'), 'baseTestnetCursor')
})
test('builds the query with a clamped limit and only provided cursors', () => {
  assert.equal(tradesQuery(), 'limit=20')
  assert.equal(tradesQuery(0), 'limit=20')
  assert.equal(tradesQuery(500), 'limit=100')
  const query = new URLSearchParams(tradesQuery(50, { combinedTestnetCursor: 'ENCODED/CURSOR+1', stellarPublicCursor: null }))
  assert.equal(query.get('limit'), '50')
  assert.equal(query.get('combinedTestnetCursor'), 'ENCODED/CURSOR+1')
  assert.equal(query.has('stellarPublicCursor'), false)
})
test('selects shuffled pages by chain/network, not position', () => {
  assert.equal(selectTradePage(result, 'base', 'public'), result.chains[0])
  assert.equal(selectTradePage(result, 'all', 'public'), result.combined[1])
  assert.equal(selectTradePage(result, 'stellar', 'testnet'), result.chains[1])
  assert.equal(selectTradePage({ ...result, combined: [] }, 'all', 'public'), undefined)
})
test('appends only new items, deduplicated by id, newest first kept', () => {
  const first = [trade('a'), trade('b')]
  const next = [trade('b'), trade('c')]
  assert.deepEqual(mergeTradeItems(first, next).map(item => item.id), ['a', 'b', 'c'])
  assert.deepEqual(mergeTradeItems([], next).map(item => item.id), ['b', 'c'])
})
test('project navigation maps all four platform networks', () => {
  for (const [chain, network, expected] of [
    ['base', 'public', 'base-mainnet'],
    ['base', 'testnet', 'base-sepolia'],
    ['stellar', 'public', 'stellar-mainnet'],
    ['stellar', 'testnet', 'stellar-testnet'],
  ]) {
    assert.equal(launchHref(trade('x', { chain, network })), `https://platform.lumenrise.app/projects/rise?network=${expected}`)
  }
})
test('accepts valid results and rejects malformed payloads', () => {
  assert.equal(isTradesResult(result), true)
  assert.equal(isTradesResult({ ...result, chains: [], combined: [] }), true)
  assert.equal(isTradesResult({ ...result, limit: 0 }), false)
  assert.equal(isTradesResult({ ...result, chains: [{ ...result.chains[0], nextCursor: 7 }] }), false)
  assert.equal(isTradesResult({ ...result, combined: [page('all', 'public', [trade('x', { amount: '1.2.3' })])] }), false)
  assert.equal(isTradesResult({ ...result, combined: [page('all', 'public', [trade('x', { side: 'hold' })])] }), false)
  assert.equal(isTradesResult({ ...result, chains: [page('stellar', 'public', [trade('x', { launch: { slug: 'rise' } })])] }), false)
})
test('summarizes loaded trades with exact decimals', () => {
  const items = [
    trade('a', { side: 'buy', amount: '10.5', trader: 'G1' }),
    trade('b', { side: 'sell', amount: '2.25', trader: 'G2', tradedAt: '2026-11-01T08:00:00Z' }),
    trade('c', { side: 'buy', amount: '0.1', trader: 'G1', launch: { slug: 'moon', name: 'Moon', symbol: 'MOON', logo: '' } }),
  ]
  const summary = summarizeTrades(items)
  assert.equal(summary.volume, '12.85')
  assert.equal(summary.buyVolume, '10.6')
  assert.equal(summary.sellVolume, '2.25')
  assert.equal(summary.netFlow, '8.35')
  assert.equal(summary.trades, 3)
  assert.equal(summary.buys, 2)
  assert.equal(summary.sells, 1)
  assert.equal(summary.wallets, 2)
  assert.equal(summary.averageSize, '4.28')
  assert.equal(summary.largest?.id, 'a')
  assert.equal(summary.buyVolumeShare, 82.4)
  assert.equal(summary.from, '2026-11-01T08:00:00.000Z')
  assert.equal(summary.to, '2026-11-01T09:00:00.000Z')
  assert.deepEqual(summary.launches.map(item => [item.launch.slug, item.volume, item.trades]), [['rise', '12.75', 2], ['moon', '0.1', 1]])
})
test('summarizes negative net flow and empty input', () => {
  assert.equal(summarizeTrades([trade('a', { side: 'sell', amount: '3' }), trade('b', { amount: '1.5' })]).netFlow, '-1.5')
  const empty = summarizeTrades([])
  assert.equal(empty.volume, '0')
  assert.equal(empty.averageSize, '0')
  assert.equal(empty.largest, null)
  assert.equal(empty.buyVolumeShare, 0)
  assert.deepEqual(empty.launches, [])
})

test('transaction hashes support the pending API field and correct explorers', async () => {
  const { displayTradeHash, transactionHref, SAMPLE_TRANSACTION_HASH } = await import('../src/lib/trades.ts')
  assert.equal(displayTradeHash(trade('x')), SAMPLE_TRANSACTION_HASH)
  assert.equal(displayTradeHash(trade('x', { chain: 'base' })), '0x' + SAMPLE_TRANSACTION_HASH)
  assert.equal(transactionHref(trade('x', { hash: 'abc' })), 'https://stellar.expert/explorer/public/tx/abc')
  assert.equal(transactionHref(trade('x', { chain: 'base', network: 'testnet', hash: '0xabc' })), 'https://sepolia.basescan.org/tx/0xabc')
  assert.equal(isTradesResult({ ...result, combined: [page('all', 'public', [trade('x', { hash: 'abc' })])] }), true)
  assert.equal(isTradesResult({ ...result, combined: [page('all', 'public', [trade('x', { hash: 123 })])] }), false)
})
