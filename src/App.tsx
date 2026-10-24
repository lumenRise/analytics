import { useState } from 'react'
import { getMarketStats } from './lib/api'
import type { Network } from './lib/market'
import { REFRESH_MS, usePolling } from './usePolling'
import ChartSection from './ChartSection'
import LaunchesSection from './LaunchesSection'
import OverviewSection from './OverviewSection'
import TradesSection from './TradesSection'
import { NetworkSwitch } from './ui'
import './App.css'

const SECTIONS = [['overview', 'Overview'], ['volume', 'Volume'], ['trades', 'Trades'], ['launches', 'Launches']] as const

const initialNetwork = (): Network => new URLSearchParams(window.location.search).get('network') === 'testnet' ? 'testnet' : 'public'

function App() {
  const [network, setNetwork] = useState<Network>(initialNetwork)
  const market = usePolling(getMarketStats, REFRESH_MS.market)

  const changeNetwork = (next: Network) => {
    setNetwork(next)
    const url = new URL(window.location.href)
    if (next === 'testnet') url.searchParams.set('network', 'testnet')
    else url.searchParams.delete('network')
    window.history.replaceState(null, '', url)
  }

  return <>
    <header className="site-header"><div className="header-inner">
      <a className="brand" href="/" aria-label="LumenRise analytics home"><img src="/branding/logo.svg" width="154" height="32" alt="LumenRise" /></a>
      <span className="header-label">Analytics</span>
      <nav className="section-nav" aria-label="Sections">
        {SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
      </nav>
      <NetworkSwitch value={network} onChange={changeNetwork} />
    </div></header>
    <main>
      <OverviewSection market={market} network={network} />
      <ChartSection network={network} />
      <TradesSection network={network} />
      <LaunchesSection market={market} network={network} />
    </main>
    <footer className="site-footer"><div className="footer-inner">
      <p>Statistics reflect indexed launch and trading activity, not website visits. Trading wallets are unique wallets that bought or sold.</p>
      <div className="footer-side">
        <nav className="footer-links" aria-label="LumenRise links">
          <a href="https://lumenrise.app" target="_blank" rel="noopener noreferrer">Website</a>
          <a href="https://docs.lumenrise.app" target="_blank" rel="noopener noreferrer">Documentation</a>
        </nav>
        <p className="fine-print">Data updates automatically.</p>
      </div>
    </div></footer>
  </>
}

export default App
