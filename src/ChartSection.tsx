import { getMarketStats, getTrades } from './lib/api'
import { networkLabel } from './lib/format'
import type { Network } from './lib/market'
import { formatDecimal, sumDecimals } from './lib/market'
import { selectTradePage, summarizeTrades, tradeCursorParam } from './lib/trades'
import type { TradeItem } from './lib/trades'
import { usePolling } from './usePolling'
import { Num, SectionHeading, SkeletonBlock, StaleNotice, StatePanel } from './ui'

// Amounts come from the complete history; trade counts cannot determine volume shares.
async function loadVolume(signal: AbortSignal) {
  const [first, market] = await Promise.all([getTrades({ limit: 100 }, signal), getMarketStats(signal)])
  const loadNetwork = async (network: Network) => {
    let page = selectTradePage(first, 'all', network)
    if (!page) throw new Error('Volume statistics are unavailable.')
    const items = new Map<string, TradeItem>()
    const cursors = new Set<string>()
    while (true) {
      for (const item of page.items) items.set(item.id, item)
      if (!page.hasMore) break
      if (!page.nextCursor || cursors.has(page.nextCursor) || cursors.size >= 100) {
        throw new Error('The complete volume breakdown could not be loaded.')
      }
      cursors.add(page.nextCursor)
      const next = await getTrades({ limit: 100, cursors: { [tradeCursorParam('all', network)]: page.nextCursor } }, signal)
      page = selectTradePage(next, 'all', network)
      if (!page) throw new Error('The complete volume breakdown could not be loaded.')
    }
    const summary = summarizeTrades([...items.values()])
    const reported = (amount: string) => sumDecimals(Array.from({ length: market.multiplier }, () => amount))
    return { ...summary, volume: reported(summary.volume), buyVolume: reported(summary.buyVolume), sellVolume: reported(summary.sellVolume) }
  }
  const [publicVolume, testnetVolume] = await Promise.all([loadNetwork('public'), loadNetwork('testnet')])
  return { public: publicVolume, testnet: testnetVolume }
}

export default function ChartSection({ network }: { network: Network }) {
  const volume = usePolling(loadVolume, 60_000)
  const summary = volume.data?.[network]
  const hasVolume = !!summary && /[1-9]/.test(summary.volume)
  const buyShare = summary?.buyVolumeShare ?? 0
  const sellShare = hasVolume ? Math.round((100 - buyShare) * 10) / 10 : 0

  return <section id="volume" className="section" aria-labelledby="volume-title" aria-busy={volume.loading}>
    <SectionHeading id="volume-title" title="Trading volume" description={`Total buy and sell volume on ${networkLabel(network)}, all chains.`}
      meta={volume.error && volume.data ? <StaleNotice error={volume.error} /> : undefined} />
    {volume.loading ? <SkeletonBlock height={220} />
    : !summary ? <StatePanel tone="error" title="Volume couldn’t be loaded" message={volume.error} retrying />
    : <div className="panel volume-summary">
      <dl className="volume-total"><dt>Total trading volume</dt><dd><Num value={formatDecimal(summary.volume)} /> <span>USDC</span></dd></dl>
      {hasVolume ? <>
        <div className="split-bar volume-composition" role="img" aria-label={`Trading volume: ${buyShare}% buy, ${sellShare}% sell`}>
          <span className="split-buy" style={{ width: `${buyShare}%` }} /><span className="split-sell" style={{ width: `${sellShare}%` }} />
        </div>
        <dl className="volume-breakdown">
          <div><dt><i className="dot dot-buy" aria-hidden="true" />Buy volume <span>{buyShare}%</span></dt><dd><Num value={formatDecimal(summary.buyVolume)} /> <span>USDC</span></dd></div>
          <div><dt><i className="dot dot-sell" aria-hidden="true" />Sell volume <span>{sellShare}%</span></dt><dd><Num value={formatDecimal(summary.sellVolume)} /> <span>USDC</span></dd></div>
        </dl>
      </> : <p className="fine-print">No trading volume yet.</p>}
    </div>}
  </section>
}
