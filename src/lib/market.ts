export type Network = 'testnet' | 'public'
export type Chain = 'stellar' | 'base' | 'all'
export type VolumeTotal = { amount: string; tradeCount: number; buyCount: number; sellCount: number }
export type MarketLaunchStats = { chain: Exclude<Chain, 'all'>; network: Network; contractId: string; slug: string; volumeTotal: VolumeTotal; participantCount: number }
export type MarketStatsGroup = { chain: Chain; network: Network; volumeTotal: VolumeTotal; launchCount: number; participantCount: number; userCount: number; launches: MarketLaunchStats[] }
export type MarketStats = { currency: 'USDC'; multiplier: 2; asOf: string; userCountScope: 'global_active_identities'; chains: MarketStatsGroup[]; combined: MarketStatsGroup[] }

// Whole USDC decimal strings: no floating-point conversion, rescaling, or multiplier.
// Round only for display, using exact integer arithmetic (at most three decimals).
export function formatDecimal(amount: string): string {
  const [whole, fraction = ''] = amount.split('.')
  const thousandths = BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, '0').slice(0, 3))
    + (fraction.length > 3 && fraction[3] >= '5' ? 1n : 0n)
  const integer = (thousandths / 1000n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const decimals = (thousandths % 1000n).toString().padStart(3, '0').replace(/0+$/, '')
  return integer + (decimals ? `.${decimals}` : '')
}
export function selectGroup(stats: MarketStats, chain: Chain, network: Network) {
  return (chain === 'all' ? stats.combined : stats.chains).find(group => group.chain === chain && group.network === network)
}
export function launchKey(launch: Pick<MarketLaunchStats, 'chain' | 'network' | 'contractId'>) {
  return JSON.stringify([launch.chain, launch.network, launch.contractId])
}
export function selectLaunch(launches: MarketLaunchStats[], key: string) {
  return launches.find(launch => launchKey(launch) === key)
}

// Exact decimal arithmetic on USDC strings, scaled to the widest fraction present.
const fractionScale = (values: string[]) => Math.max(0, ...values.map(value => value.split('.')[1]?.length ?? 0))
const toUnits = (value: string, scale: number) => {
  const [whole, fraction = ''] = value.split('.')
  return BigInt(whole) * 10n ** BigInt(scale) + BigInt(fraction.padEnd(scale, '0') || '0')
}
const fromUnits = (units: bigint, scale: number) => {
  const digits = units.toString().padStart(scale + 1, '0')
  if (scale === 0) return digits
  const fraction = digits.slice(-scale).replace(/0+$/, '')
  return digits.slice(0, -scale) + (fraction ? `.${fraction}` : '')
}

export function sumDecimals(values: string[]): string {
  const scale = fractionScale(values)
  return fromUnits(values.reduce((total, value) => total + toUnits(value, scale), 0n), scale)
}

export type RankedLaunch = { launch: MarketLaunchStats; share: number }

// Highest volume first; shares are display-only percentages of the listed launches' volume, one decimal.
export function rankLaunches(launches: MarketLaunchStats[]): RankedLaunch[] {
  const scale = fractionScale(launches.map(launch => launch.volumeTotal.amount))
  const rows = launches.map(launch => ({ launch, units: toUnits(launch.volumeTotal.amount, scale) }))
  const total = rows.reduce((sum, row) => sum + row.units, 0n)
  return rows
    .sort((a, b) => (b.units > a.units ? 1 : b.units < a.units ? -1 : 0)
      || b.launch.volumeTotal.tradeCount - a.launch.volumeTotal.tradeCount
      || a.launch.slug.localeCompare(b.launch.slug)
      || launchKey(a.launch).localeCompare(launchKey(b.launch)))
    .map(row => ({ launch: row.launch, share: total > 0n ? Number((row.units * 1000n) / total) / 10 : 0 }))
}

// Reject malformed payloads instead of rendering misleading partial statistics.
export function isMarketStats(value: unknown): value is MarketStats {
  const object = (item: unknown): item is Record<string, unknown> => !!item && typeof item === 'object'
  const count = (item: unknown) => typeof item === 'number' && Number.isSafeInteger(item) && item >= 0
  const volume = (item: unknown) => object(item) && typeof item.amount === 'string' && /^\d+(\.\d+)?$/.test(item.amount) && count(item.tradeCount) && count(item.buyCount) && count(item.sellCount)
  const network = (item: unknown) => item === 'public' || item === 'testnet'
  const launch = (item: unknown): boolean => object(item) && (item.chain === 'stellar' || item.chain === 'base') && network(item.network) && typeof item.contractId === 'string' && typeof item.slug === 'string' && volume(item.volumeTotal) && count(item.participantCount)
  const group = (item: unknown): boolean => object(item) && (item.chain === 'all' || item.chain === 'stellar' || item.chain === 'base') && network(item.network) && volume(item.volumeTotal) && count(item.launchCount) && count(item.participantCount) && count(item.userCount) && Array.isArray(item.launches) && item.launches.every(launch)
  return object(value) && value.currency === 'USDC' && value.multiplier === 2 && typeof value.asOf === 'string' && value.userCountScope === 'global_active_identities' && Array.isArray(value.chains) && value.chains.every(group) && Array.isArray(value.combined) && value.combined.every(group)
}
