// Numbered pagination with a collapsed window around the current page.
// hasMoreBeyond keeps "Next" enabled past the last page when more data can be loaded.
export default function Pagination({ page, pages, hasMoreBeyond = false, onPage, label }: {
  page: number
  pages: number
  hasMoreBeyond?: boolean
  onPage: (page: number) => void
  label: string
}) {
  const unique = [...new Set(pages <= 7
    ? Array.from({ length: pages }, (_, index) => index + 1)
    : [1, page - 1, page, page + 1, pages].filter(number => number >= 1 && number <= pages))].sort((a, b) => a - b)
  const items: (number | 'gap')[] = []
  unique.forEach((number, index) => {
    if (index > 0 && number - unique[index - 1] > 1) items.push('gap')
    items.push(number)
  })
  return <nav className="pagination" aria-label={label}>
    <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
    {items.map((item, index) => item === 'gap'
      ? <span key={`gap-${index}`} className="pagination-gap" aria-hidden="true">…</span>
      : <button key={item} type="button" aria-current={item === page ? 'page' : undefined} onClick={() => onPage(item)}>{item}</button>)}
    <button type="button" disabled={page >= pages && !hasMoreBeyond} onClick={() => onPage(page + 1)}>Next</button>
  </nav>
}
