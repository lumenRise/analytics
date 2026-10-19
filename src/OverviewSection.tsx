import { count } from './lib/format'
import type { MarketStats, Network } from './lib/market'
import { formatDecimal, selectGroup } from './lib/market'
import type { Polled } from './usePolling'
import { NetworkTag, StatGrid, StatGridSkeleton, StatePanel } from './ui'

export default function OverviewSection({ market, network }: { market: Polled<MarketStats>; network: Network }) {
  const group = market.data ? selectGroup(market.data, 'all', network) : undefined
  const status = market.loading ? 'Connecting…'
    : market.error ? (market.data ? 'Update delayed · retrying' : 'Unavailable · retrying')
    : market.data ? 'Live' : ''

  return <section id="overview" className="section" aria-labelledby="overview-title" aria-busy={market.loading}>
    <div className="page-title">
      <div>
        <h1 id="overview-title">Market overview</h1>
        <p>Trading activity across the LumenRise ecosystem, all chains. <NetworkTag network={network} /></p>
      </div>
      <p className={`live${market.error ? ' is-delayed' : ''}`} title={market.error ?? undefined}><span className="live-dot" aria-hidden="true" />{status}</p>
    </div>
    {market.loading ? <StatGridSkeleton count={5} className="stat-grid--5" />
    : !market.data ? <StatePanel tone="error" title="Statistics couldn’t be loaded" message={market.error} retrying />
    : !group ? <StatePanel title="No statistics yet" message="There is no indexed data for this network yet." />
    : <StatGrid className="stat-grid--5" items={[
      { label: 'Trading volume', value: formatDecimal(group.volumeTotal.amount), unit: 'USDC', help: 'All-time, all chains' },
      { label: 'Trades', value: count(group.volumeTotal.tradeCount), help: `${count(group.volumeTotal.buyCount)} buys · ${count(group.volumeTotal.sellCount)} sells` },
      { label: 'Launches', value: count(group.launchCount), help: 'Across the ecosystem' },
      { label: 'Trading wallets', value: count(group.participantCount), help: 'Unique wallets that bought or sold' },
      { label: 'Registered users', value: count(group.userCount), help: 'Active identities · all networks' },
    ]} />}
  </section>
}
