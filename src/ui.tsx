import { Fragment, useState } from 'react'
import type { ReactNode } from 'react'
import type { Network } from './lib/market'
import { networkLabel } from './lib/format'

// Lets long formatted numbers wrap only at thousands separators, never mid-digit.
export function Num({ value }: { value: string }) {
  return <>{value.split(',').map((part, index) => <Fragment key={index}>{index > 0 && <>,<wbr /></>}{part}</Fragment>)}</>
}

export type Stat = { label: string; value: string; unit?: string; help?: ReactNode; tone?: 'up' | 'down' }

export function StatGrid({ items, className = '' }: { items: Stat[]; className?: string }) {
  return <dl className={`stat-grid ${className}`}>
    {items.map(item => <div className="stat" key={item.label}>
      <dt>{item.label}</dt>
      <dd className={item.tone ? `tone-${item.tone}` : undefined}><Num value={item.value} />{item.unit && <small>{item.unit}</small>}</dd>
      {item.help && <p>{item.help}</p>}
    </div>)}
  </dl>
}

export function StatGridSkeleton({ count, className = '' }: { count: number; className?: string }) {
  return <div className={`stat-grid ${className}`} aria-hidden="true">
    {Array.from({ length: count }, (_, index) => <div className="stat" key={index}>
      <span className="skeleton-line" style={{ width: '55%' }} />
      <span className="skeleton-line skeleton-line-lg" style={{ width: '80%' }} />
      <span className="skeleton-line" style={{ width: '65%' }} />
    </div>)}
  </div>
}

export function SkeletonBlock({ height }: { height: number }) {
  return <div className="skeleton-block" style={{ height }} aria-hidden="true" />
}

export function SectionHeading({ id, title, description, meta }: { id: string; title: string; description: ReactNode; meta?: ReactNode }) {
  return <div className="section-heading">
    <div><h2 id={id}>{title}</h2><p>{description}</p></div>
    {meta && <div className="section-meta">{meta}</div>}
  </div>
}

export function StatePanel({ title, message, tone, retrying = false }: { title: string; message?: string | null; tone?: 'error'; retrying?: boolean }) {
  return <div className={`state${tone === 'error' ? ' state-error' : ''}`} role={tone === 'error' ? 'alert' : undefined}>
    <h3>{title}</h3>
    {message && <p>{message}</p>}
    {retrying && <p className="fine-print">Retrying automatically.</p>}
  </div>
}

export function StaleNotice({ error }: { error: string }) {
  return <span className="notice" role="status" title={error}>Update delayed · retrying</span>
}

export function NetworkTag({ network }: { network: Network }) {
  return <span className={`tag tag-${network}`}>{networkLabel(network)}</span>
}

export function NetworkSwitch({ value, onChange }: { value: Network; onChange: (network: Network) => void }) {
  return <div className="segmented" role="group" aria-label="Network">
    {(['public', 'testnet'] as const).map(network => <button key={network} type="button" aria-pressed={value === network} onClick={() => onChange(network)}>{networkLabel(network)}</button>)}
  </div>
}

export function LaunchMark({ name, logo }: { name: string; logo?: string }) {
  const [failed, setFailed] = useState(false)
  if (!logo || failed) return <span className="launch-mark launch-mark-fallback" aria-hidden="true">{(name || '?').slice(0, 1).toUpperCase()}</span>
  return <img className="launch-mark" src={logo} alt="" width={28} height={28} loading="lazy" onError={() => setFailed(true)} />
}

export function LaunchCell({ name, sub, href, logo, title }: { name: string; sub?: string; href?: string; logo?: string; title?: string }) {
  const body = <>
    <LaunchMark name={name} logo={logo} />
    <span className="launch-text"><span className="launch-name">{name}</span>{sub && <span className="launch-sub" title={title}>{sub}</span>}</span>
  </>
  return href
    ? <a className="launch-cell" href={href} target="_blank" rel="noopener noreferrer">{body}</a>
    : <span className="launch-cell">{body}</span>
}

export function ShareBar({ share }: { share: number }) {
  return <span className="share">
    <span className="share-bar" aria-hidden="true"><span style={{ width: `${Math.min(100, share)}%` }} /></span>
    <span className="share-value">{share}%</span>
  </span>
}

