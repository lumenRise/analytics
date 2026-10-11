import type { Chain, Network } from './market'

export const count = (value: number) => value.toLocaleString('en-US')

export const compact = (value: number) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)

export const dateTime = (iso: string) => Number.isNaN(Date.parse(iso))
  ? iso
  : new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })

export const clockTime = (iso: string) => Number.isNaN(Date.parse(iso))
  ? iso
  : new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' })

export const networkLabel = (network: Network) => network === 'public' ? 'Mainnet' : 'Testnet'

export const chainLabel = (chain: Exclude<Chain, 'all'>) => chain === 'stellar' ? 'Stellar' : 'Base'

export const shortAddress = (address: string) => address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
