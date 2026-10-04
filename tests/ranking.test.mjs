import assert from 'node:assert/strict'
import test from 'node:test'
import { rankLaunches, sumDecimals } from '../src/lib/market.ts'

const launch = (slug, amount, tradeCount = 1, chain = 'stellar') => ({ chain, network: 'public', contractId: `c-${slug}`, slug, volumeTotal: { amount, tradeCount, buyCount: tradeCount, sellCount: 0 }, participantCount: 1 })

test('sums decimal strings exactly, beyond float precision', () => {
  assert.equal(sumDecimals(['9007199254740993.1', '0.000000000000000001']), '9007199254740993.100000000000000001')
  assert.equal(sumDecimals(['1.50', '2.5']), '4')
  assert.equal(sumDecimals([]), '0')
})

test('ranks launches by exact volume, then trades and slug, with one-decimal shares', () => {
  const ranked = rankLaunches([
    launch('b', '9007199254740993'),
    launch('a', '9007199254740992'),
    launch('c', '9007199254740993', 5),
    launch('zero', '0'),
  ])
  assert.deepEqual(ranked.map(row => row.launch.slug), ['c', 'b', 'a', 'zero'])
  assert.equal(ranked[3].share, 0)
  assert.equal(ranked[0].share, 33.3)
})

test('empty or zero-volume launches have zero shares', () => {
  assert.deepEqual(rankLaunches([]), [])
  assert.equal(rankLaunches([launch('a', '0')])[0].share, 0)
})
