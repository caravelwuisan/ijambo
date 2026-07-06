/**
 * Mini-rendu Markdown (titres, gras/italique, listes, citations, tableaux, code inline).
 * Volontairement minimal pour tenir le budget bundle < 300 Ko (§2) — pas de lib externe.
 */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function inline(s: string): string {
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" loading="lazy" style="max-width:100%;border-radius:10px" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
}

export function renderMarkdown(md: string): string {
  const lines = escapeHtml(md).split(/\r?\n/)
  const out: string[] = []
  let list: 'ul' | 'ol' | null = null
  let inTable = false

  const closeList = () => {
    if (list) {
      out.push(`</${list}>`)
      list = null
    }
  }
  const closeTable = () => {
    if (inTable) {
      out.push('</tbody></table>')
      inTable = false
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.slice(1, -1).split('|').map((c) => c.trim())
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue // ligne séparatrice
      if (!inTable) {
        closeList()
        out.push('<table><tbody>')
        inTable = true
        out.push('<tr>' + cells.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr>')
      } else {
        out.push('<tr>' + cells.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>')
      }
      continue
    }
    closeTable()

    const h = trimmed.match(/^(#{1,3})\s+(.*)$/)
    if (h) {
      closeList()
      const lvl = h[1].length
      out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`)
      continue
    }
    if (trimmed.startsWith('> ')) {
      closeList()
      out.push(`<blockquote>${inline(trimmed.slice(2))}</blockquote>`)
      continue
    }
    const ul = trimmed.match(/^[-*]\s+(.*)$/)
    const ol = trimmed.match(/^\d+[.)]\s+(.*)$/)
    if (ul || ol) {
      const kind = ul ? 'ul' : 'ol'
      if (list !== kind) {
        closeList()
        out.push(`<${kind}>`)
        list = kind
      }
      out.push(`<li>${inline((ul ?? ol)![1])}</li>`)
      continue
    }
    closeList()
    if (trimmed === '') continue
    out.push(`<p>${inline(trimmed)}</p>`)
  }
  closeList()
  closeTable()
  return out.join('\n')
}
