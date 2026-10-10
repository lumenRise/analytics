import { useCallback, useEffect, useState } from 'react'
import { describeApiError } from './lib/api'

export const REFRESH_MS = { trades: 10_000, market: 15_000, chart: 30_000 } as const

export type Polled<T> = { data: T | null; error: string | null; loading: boolean }

const latest = (_previous: unknown, next: unknown) => next

// Polls only while the tab is visible and keeps the last good data when an update fails,
// so a temporary outage shows a notice instead of blanking the page.
// `load` and `reduce` must be stable (module-level) functions; without `reduce` each response replaces the data.
export function usePolling<R, T = R>(load: (signal: AbortSignal) => Promise<R>, intervalMs: number, reduce: (previous: T | null, next: R) => T = latest as (previous: T | null, next: R) => T) {
  const [state, setState] = useState<Polled<T>>({ data: null, error: null, loading: true })

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let running = false
    let lastRun = 0

    const schedule = () => {
      if (controller.signal.aborted || document.hidden || running || timer !== undefined) return
      timer = setTimeout(run, Math.max(0, lastRun + intervalMs - Date.now()))
    }
    const run = async () => {
      timer = undefined
      running = true
      lastRun = Date.now()
      try {
        const next = await load(controller.signal)
        if (controller.signal.aborted) return
        setState(current => ({ data: reduce(current.data, next), error: null, loading: false }))
      } catch (reason) {
        if (controller.signal.aborted) return
        setState(current => ({ ...current, error: describeApiError(reason), loading: false }))
      } finally {
        running = false
      }
      schedule()
    }
    const onVisibility = () => {
      if (document.hidden) { clearTimeout(timer); timer = undefined } else schedule()
    }

    document.addEventListener('visibilitychange', onVisibility)
    void run()
    return () => {
      controller.abort()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [load, reduce, intervalMs])

  const update = useCallback((change: (data: T) => T) => {
    setState(current => current.data === null ? current : { ...current, data: change(current.data) })
  }, [])

  return { ...state, update }
}
