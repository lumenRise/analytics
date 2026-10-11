import type { MouseEvent } from 'react'

// Native launch links provide keyboard navigation; clicking other cells opens the launch too.
export function openLaunchRow(event: MouseEvent<HTMLTableRowElement>, href?: string) {
  if (!href || event.defaultPrevented || event.button !== 0 || window.getSelection()?.toString()) return
  if ((event.target as HTMLElement).closest('a, button, input')) return
  window.open(href, '_blank', 'noopener,noreferrer')
}
