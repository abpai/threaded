const THREAD_ANCHOR_ATTR = "data-thread-anchor"

const THREAD_ANCHOR_CLASS = "thread-anchor"

const BLOCK_SELECTORS = [
  "p",
  "li",
  "blockquote",
  "pre",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "td",
  "th",
].join(",")

function createAnchorEl(threadId: string) {
  const el = document.createElement("span")
  el.setAttribute(THREAD_ANCHOR_ATTR, threadId)
  el.className = THREAD_ANCHOR_CLASS
  el.tabIndex = 0
  el.setAttribute("role", "button")
  return el
}

function getBlockAncestor(node: Node | null): Element | null {
  if (!node) return null
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
  return el?.closest(BLOCK_SELECTORS) ?? null
}

function findTextNodes(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: node => {
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      if (parent.closest(`[${THREAD_ANCHOR_ATTR}]`)) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })

  const nodes: Text[] = []
  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text)
  }

  return nodes
}

function resolveTextOffset(nodes: Text[], offset: number) {
  let remaining = offset
  for (const node of nodes) {
    const len = node.nodeValue?.length ?? 0
    if (remaining <= len) {
      return { node, offset: remaining }
    }
    remaining -= len
  }
  const last = nodes[nodes.length - 1]
  return { node: last, offset: last.nodeValue?.length ?? 0 }
}

function wrapRange(range: Range, threadId: string) {
  const anchorEl = createAnchorEl(threadId)
  try {
    range.surroundContents(anchorEl)
    return anchorEl
  } catch {
    const contents = range.extractContents()
    anchorEl.appendChild(contents)
    range.insertNode(anchorEl)
    return anchorEl
  }
}

export function wrapCurrentSelectionWithThreadAnchor(root: HTMLElement, threadId: string) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null

  const range = selection.getRangeAt(0)
  if (!root.contains(range.commonAncestorContainer)) return null

  const startBlock = getBlockAncestor(range.startContainer)
  const endBlock = getBlockAncestor(range.endContainer)
  if (!startBlock || startBlock !== endBlock) return null

  return wrapRange(range, threadId)
}

export function wrapFirstOccurrenceWithThreadAnchor(
  root: HTMLElement,
  text: string,
  threadId: string
) {
  const needle = text.trim()
  if (needle.length < 2) return null
  if (needle.includes("\n")) return null

  const nodes = findTextNodes(root)
  if (nodes.length === 0) return null

  const haystack = nodes.map(n => n.nodeValue ?? "").join("")
  const index = haystack.indexOf(needle)
  if (index === -1) return null

  const start = resolveTextOffset(nodes, index)
  const end = resolveTextOffset(nodes, index + needle.length)

  const range = document.createRange()
  range.setStart(start.node, start.offset)
  range.setEnd(end.node, end.offset)

  const startBlock = getBlockAncestor(range.startContainer)
  const endBlock = getBlockAncestor(range.endContainer)
  if (!startBlock || startBlock !== endBlock) return null

  return wrapRange(range, threadId)
}

export function updateThreadAnchorId(el: HTMLElement, threadId: string) {
  el.setAttribute(THREAD_ANCHOR_ATTR, threadId)
}

export function setThreadAnchorActive(el: HTMLElement, isActive: boolean) {
  if (isActive) {
    el.setAttribute("data-thread-active", "true")
    return
  }
  el.removeAttribute("data-thread-active")
}

export function removeThreadAnchor(el: HTMLElement) {
  const parent = el.parentNode
  if (!parent) return

  while (el.firstChild) {
    parent.insertBefore(el.firstChild, el)
  }
  parent.removeChild(el)
  parent.normalize()
}
