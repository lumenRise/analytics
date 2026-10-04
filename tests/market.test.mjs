import assert from 'node:assert/strict'
import test from 'node:test'
import { formatDecimal, selectGroup, launchKey, selectLaunch, isMarketStats } from '../src/lib/market.ts'
const volumeTotal = { amount: '9007199254740993.123456789012345678', tradeCount: 8, buyCount: 5, sellCount: 3 }
const launch = (chain, network, contractId) => ({ chain, network, contractId, slug: 'example', volumeTotal, participantCount: 4 })
const group = (chain, network) => ({ chain, network, volumeTotal, launchCount: 2, participantCount: 5, userCount: 21, launches: [launch(chain === 'all' ? 'stellar' : chain, network, 'same-contract')] })
const stats = { currency: 'USDC', multiplier: 2, asOf: '2026-11-01T10:00:00Z', userCountScope: 'global_active_identities', chains: [group('base', 'public'), group('stellar', 'testnet'), group('stellar', 'public'), group('base', 'testnet')], combined: [group('all', 'testnet'), group('all', 'public')] }
test('whole USDC rounds to three decimals with exact arithmetic and carry', () => {
  assert.equal(formatDecimal(volumeTotal.amount), '9,007,199,254,740,993.123')
  assert.equal(formatDecimal('0.00000001'), '0')
  assert.equal(formatDecimal('1000.00'), '1,000')
  assert.equal(formatDecimal('999.9995'), '1,000')
  assert.equal(formatDecimal('1.2345'), '1.235')
  assert.equal(formatDecimal('1.2344'), '1.234')
  assert.equal(formatDecimal('9007199254740993.9995'), '9,007,199,254,740,994')
})
test('selects shuffled groups by chain/network, keeping server counts', () => {
  assert.equal(selectGroup(stats, 'base', 'public'), stats.chains[0])
  assert.equal(selectGroup(stats, 'all', 'public'), stats.combined[1])
  assert.equal(selectGroup(stats, 'all', 'public').participantCount, 5)
  assert.equal(selectGroup(stats, 'all', 'public').userCount, 21)
  assert.equal(selectGroup({ ...stats, chains: [] }, 'stellar', 'public'), undefined)
})
test('launch identity includes chain, network and contract', () => {
  const launches = [launch('stellar', 'public', 'same'), launch('base', 'public', 'same'), launch('base', 'testnet', 'same')]
  assert.equal(selectLaunch(launches, launchKey(launches[2])), launches[2])
})
test('rejects malformed decimals and counts, accepts empty indexed groups', () => {
  assert.equal(isMarketStats(stats), true)
  assert.equal(isMarketStats({ ...stats, combined: [], chains: [] }), true)
  assert.equal(isMarketStats({ ...stats, combined: [{ ...stats.combined[0], volumeTotal: { ...volumeTotal, amount: 123 } }] }), false)
  assert.equal(isMarketStats({ ...stats, chains: [{ ...stats.chains[0], participantCount: -1 }] }), false)
})
