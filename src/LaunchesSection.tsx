import { openLaunchRow } from './lib/navigation'
import { useMemo, useState } from 'react'
import { chainLabel, count, shortAddress } from './lib/format'
import type { MarketStats, Network } from './lib/market'
import { formatDecimal, launchKey, rankLaunches, selectGroup } from './lib/market'
import { launchHref } from './lib/trades'
import Pagination from './Pagination'
import type { Polled } from './usePolling'
import { LaunchCell, Num, SectionHeading, ShareBar, SkeletonBlock, StatePanel } from './ui'

const LAUNCH_PAGE_SIZE = 10

export default function LaunchesSection({ market, network }: { market: Polled<MarketStats>; network: Network }) {
  const [pageState, setPageState] = useState({ network, page: 1 })
  const group = market.data ? selectGroup(market.data, 'all', network) : undefined
  const ranked = useMemo(() => group ? rankLaunches(group.launches) : [], [group])
  const pages = Math.max(1, Math.ceil(ranked.length / LAUNCH_PAGE_SIZE))
  const page = Math.min(pageState.network === network ? pageState.page : 1, pages)
  const start = (page - 1) * LAUNCH_PAGE_SIZE
  const visible = ranked.slice(start, start + LAUNCH_PAGE_SIZE)

  return <section id="launches" className="section" aria-labelledby="launches-title" aria-busy={market.loading}>
    <SectionHeading id="launches-title" title="Launches" description="Every launch ranked by all-time trading volume, all chains."
      meta={ranked.length > 0 ? `${count(ranked.length)} launches` : undefined} />
    {market.loading ? <SkeletonBlock height={360} />
    : !market.data ? <StatePanel tone="error" title="Launches couldn’t be loaded" message={market.error} retrying />
    : ranked.length === 0 ? <StatePanel title="No launch activity yet" message="Launches will appear here once their trading history is indexed." />
    : <>
      <div className="table-scroll"><table>
        <thead><tr>
          <th scope="col" className="col-rank">#</th>
          <th scope="col">Launch</th>
          <th scope="col" className="num">Volume · USDC</th>
          <th scope="col" className="num">Share of volume</th>
          <th scope="col" className="num">Trades</th>
          <th scope="col" className="num">Buys / sells</th>
        </tr></thead>
        <tbody>{visible.map(({ launch, share }, index) => <tr key={launchKey(launch)} className={launch.slug ? 'linked-row' : undefined} onClick={event => openLaunchRow(event, launch.slug ? launchHref({ chain: launch.chain, network: launch.network, launch }) : undefined)}>
          <td className="col-rank">{start + index + 1}</td>
          <th scope="row"><LaunchCell name={launch.slug || 'Unnamed launch'} sub={`${chainLabel(launch.chain)} · ${shortAddress(launch.contractId)}`} title={launch.contractId}
            href={launch.slug ? launchHref({ chain: launch.chain, network: launch.network, launch }) : undefined} /></th>
          <td className="num"><Num value={formatDecimal(launch.volumeTotal.amount)} /></td>
          <td className="num"><ShareBar share={share} /></td>
          <td className="num">{count(launch.volumeTotal.tradeCount)}</td>
          <td className="num">{count(launch.volumeTotal.buyCount)} / {count(launch.volumeTotal.sellCount)}</td>
        </tr>)}</tbody>
      </table></div>
      {pages > 1 && <Pagination page={page} pages={pages} onPage={next => setPageState({ network, page: next })} label="Launch pages" />}
    </>}
  </section>
}
