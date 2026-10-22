import { openLaunchRow } from './lib/navigation'
import { useMemo, useState } from 'react'
import { describeApiError, getTrades } from './lib/api'
import { chainLabel, count, networkLabel, shortAddress } from './lib/format'
import type { Network } from './lib/market'
import { formatDecimal } from './lib/market'
import type { TradeItem, TradePage, TradesResult } from './lib/trades'
import { TRADE_PAGE_LIMIT, launchHref, mergeTradeItems, selectTradePage, summarizeTrades, tradeCursorParam, displayTradeHash, transactionHref } from './lib/trades'
import Pagination from './Pagination'
import { REFRESH_MS, usePolling } from './usePolling'
import { LaunchCell, Num, SectionHeading, SkeletonBlock, StaleNotice, StatGrid, StatGridSkeleton, StatePanel } from './ui'

const TRADE_PAGE_SIZE = 10
const NETWORKS: Network[] = ['public', 'testnet']

type GroupState = { items: TradeItem[]; hasMore: boolean; nextCursor: string | null; asOf: string | null }
type Groups = Partial<Record<Network, GroupState>>

const toGroupState = (page: TradePage): GroupState => ({ items: page.items, hasMore: page.hasMore, nextCursor: page.nextCursor, asOf: page.asOf })

const loadTrades = (signal: AbortSignal) => getTrades({ limit: TRADE_PAGE_LIMIT }, signal)

// Each poll returns the newest page per network. New trades are prepended so loaded
// history and cursors survive; a page of only unseen trades with more behind it may
// hide a gap, so that network restarts from the newest page instead.
function reduceTrades(previous: Groups | null, result: TradesResult): Groups {
  const next: Groups = {}
  for (const network of NETWORKS) {
    const page = selectTradePage(result, 'all', network)
    const old = previous?.[network]
    if (!page) { if (old) next[network] = old; continue }
    if (!old) { next[network] = toGroupState(page); continue }
    const known = new Set(old.items.map(item => item.id))
    const fresh = page.items.filter(item => !known.has(item.id))
    next[network] = fresh.length > 0 && fresh.length === page.items.length && page.hasMore
      ? toGroupState(page)
      : { ...old, items: [...fresh, ...old.items], asOf: page.asOf }
  }
  return next
}

const time = (iso: string) => { const parsed = Date.parse(iso); return Number.isNaN(parsed) ? 0 : parsed }
const signed = (value: string) => value.startsWith('-') ? `−${formatDecimal(value.slice(1))}` : value === '0' ? '0' : `+${formatDecimal(value)}`

function Split({ label, buy, buyText, sellText }: { label: string; buy: number; buyText: string; sellText: string }) {
  const sell = Math.round((100 - buy) * 10) / 10
  return <div className="split">
    <div className="split-label"><span>{label}</span><span>{buy}% buy · {sell}% sell</span></div>
    <div className="split-bar" role="img" aria-label={`${label}: ${buy}% buy, ${sell}% sell`}><span className="split-buy" style={{ width: `${buy}%` }} /><span className="split-sell" style={{ width: `${sell}%` }} /></div>
    <div className="split-values"><span><i className="dot dot-buy" />{buyText}</span><span><i className="dot dot-sell" />{sellText}</span></div>
  </div>
}

export default function TradesSection({ network }: { network: Network }) {
  const trades = usePolling(loadTrades, REFRESH_MS.trades, reduceTrades)
  const { update } = trades
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<{ network: Network; message: string } | null>(null)
  const [pageState, setPageState] = useState({ network, page: 1 })

  const group = trades.data?.[network]
  const items = useMemo(() => [...(group?.items ?? [])].sort((a, b) => time(b.tradedAt) - time(a.tradedAt)), [group])
  const summary = useMemo(() => summarizeTrades(items), [items])
  const hasMore = !!(group?.hasMore && group.nextCursor)

  const loadMore = async (): Promise<boolean> => {
    if (!group?.hasMore || !group.nextCursor || loadingMore) return false
    const cursor = group.nextCursor
    setLoadingMore(true)
    setMoreError(null)
    try {
      const result = await getTrades({ limit: TRADE_PAGE_LIMIT, cursors: { [tradeCursorParam('all', network)]: cursor } })
      const page = selectTradePage(result, 'all', network)
      if (!page) return false
      update(data => {
        const state = data[network]
        // A poll may have restarted this network meanwhile; an old cursor's page would no longer connect.
        if (!state || state.nextCursor !== cursor) return data
        return { ...data, [network]: { ...state, items: mergeTradeItems(state.items, page.items), hasMore: page.hasMore, nextCursor: page.nextCursor } }
      })
      return true
    } catch (reason) {
      setMoreError({ network, message: describeApiError(reason) })
      return false
    } finally {
      setLoadingMore(false)
    }
  }

  const pages = Math.max(1, Math.ceil(items.length / TRADE_PAGE_SIZE))
  const current = Math.min(pageState.network === network ? pageState.page : 1, pages)
  const visible = items.slice((current - 1) * TRADE_PAGE_SIZE, current * TRADE_PAGE_SIZE)
  // Stepping past the loaded pages fetches the next batch first.
  const goTo = async (next: number) => {
    if (next > pages) { if (await loadMore()) setPageState({ network, page: next }) }
    else setPageState({ network, page: Math.max(1, next) })
  }
  const buyersLead = summary.buyVolumeShare >= 50

  return <section id="trades" className="section" aria-labelledby="trades-title" aria-busy={trades.loading}>
    <SectionHeading id="trades-title" title="Trades" description={`Buy and sell flow and the latest trades on ${networkLabel(network)}, all chains.`}
      meta={trades.error && trades.data ? <StaleNotice error={trades.error} /> : undefined} />
    {trades.loading ? <><StatGridSkeleton count={4} className="stat-grid--4" /><SkeletonBlock height={320} /></>
    : !trades.data ? <StatePanel tone="error" title="Trades couldn’t be loaded" message={trades.error} retrying />
    : items.length === 0 ? <StatePanel title="No trades yet" message="Trades will appear here once they are indexed." />
    : <>
      <p className="fine-print sample-note">Based on the {count(items.length)} most recent trades{hasMore ? '' : ' · full indexed history'}</p>
      <StatGrid className="stat-grid--4" items={[
        { label: 'Trading volume', value: formatDecimal(summary.volume), unit: 'USDC', help: `${count(summary.buys)} buys · ${count(summary.sells)} sells` },
        { label: 'Net flow', value: signed(summary.netFlow), unit: 'USDC', tone: summary.netFlow === '0' ? undefined : summary.netFlow.startsWith('-') ? 'down' : 'up', help: 'Buy volume minus sell volume' },
        { label: 'Trading wallets', value: count(summary.wallets), help: `${(summary.trades / Math.max(1, summary.wallets)).toFixed(1)} trades per wallet` },
        { label: 'Average trade', value: formatDecimal(summary.averageSize), unit: 'USDC', help: summary.largest ? `Largest ${formatDecimal(summary.largest.amount)} USDC` : 'No trades' },
      ]} />

      <article className="panel" aria-labelledby="pressure-title">
        <header className="panel-header"><h3 id="pressure-title">Buy / sell pressure</h3><span className={`side side-${buyersLead ? 'buy' : 'sell'}`}>{buyersLead ? 'Buyers lead' : 'Sellers lead'}</span></header>
        <div className="split-grid">
          <Split label="By volume" buy={summary.buyVolumeShare} buyText={`${formatDecimal(summary.buyVolume)} USDC`} sellText={`${formatDecimal(summary.sellVolume)} USDC`} />
          <Split label="By trade count" buy={summary.buyCountShare} buyText={`${count(summary.buys)} buys`} sellText={`${count(summary.sells)} sells`} />
        </div>
      </article>

      <div className="subheading"><h3>Latest trades</h3><span className="section-meta">Page {current} of {pages}</span></div>
      <div className="table-scroll"><table>
        <thead><tr>
          <th scope="col">Launch</th>
          <th scope="col">Side</th>
          <th scope="col" className="num">Value · USDC</th>
          <th scope="col" className="num">Quantity</th>
          <th scope="col" className="num">Price · USDC</th>
          <th scope="col">Transaction hash</th>
        </tr></thead>
        <tbody>{visible.map(trade => <tr key={trade.id} className={trade.launch.slug ? 'linked-row' : undefined} onClick={event => openLaunchRow(event, trade.launch.slug ? launchHref(trade) : undefined)}>
          <th scope="row"><LaunchCell name={trade.launch.name || trade.launch.slug || 'Unnamed launch'} logo={trade.launch.logo}
            sub={[trade.launch.symbol, chainLabel(trade.chain)].filter(Boolean).join(' · ')} href={trade.launch.slug ? launchHref(trade) : undefined} /></th>
          <td><span className={`side side-${trade.side}`}>{trade.side === 'buy' ? 'Buy' : 'Sell'}</span></td>
          <td className="num"><Num value={formatDecimal(trade.amount)} /></td>
          <td className="num"><Num value={formatDecimal(trade.assetAmount)} /></td>
          <td className="num"><Num value={formatDecimal(trade.price)} /></td>
          <td><a className="mono transaction-link" href={transactionHref(trade)} title={displayTradeHash(trade)} target="_blank" rel="noopener noreferrer">{shortAddress(displayTradeHash(trade))}</a>{!trade.hash?.trim() && <span className="hash-sample">Sample</span>}</td>
        </tr>)}</tbody>
      </table></div>
      {moreError?.network === network && <p className="notice notice-block" role="alert">{moreError.message} <button type="button" className="link-button" onClick={() => void loadMore()}>Try again</button></p>}
      <Pagination page={current} pages={pages} hasMoreBeyond={hasMore} onPage={next => void goTo(next)} label="Trade pages" />
      <p className="fine-print table-note" aria-live="polite">{loadingMore ? 'Loading older trades…' : hasMore ? 'Older trades load as you page forward.' : 'End of indexed history.'}</p>
    </>}
  </section>
}
