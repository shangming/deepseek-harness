/**
 * Transcript selection reading: which document selection is quotable, the text
 * it carries, and the viewport point its action anchors to.
 * @module @deepseek-ai/dsh-client-ui-message-quote/client/selection
 */

/** Scrollport owning conversation history; the composer and sidebars sit outside it. */
export const TRANSCRIPT_SELECTOR = '[data-conversation-scroll]'

/** One rendered conversation, transcript and composer together (ui-conversation's content root). */
export const CONVERSATION_SELECTOR = '[data-conversation-content]'

/** `Node.ELEMENT_NODE`, named here so the module reads without reaching for the global. */
const ELEMENT_NODE = 1

/**
 * The transcript scrollport of the conversation that owns `marker`, which is how
 * one composer finds the transcript its selections may quote. The composer chain
 * keeps a hidden fallback composer mounted while another takes over, and a portal
 * escapes that hiding, so the owning conversation is the only sound scope.
 * @param marker - an element rendered inside the composer's own conversation.
 * @returns the scrollport, or null when the marker sits outside a rendered conversation.
 */
export function owningTranscript(marker: Element | null): Element | null {
  return marker?.closest(CONVERSATION_SELECTOR)?.querySelector(TRANSCRIPT_SELECTOR) ?? null
}

/** One quotable selection inside the conversation transcript. */
export interface TranscriptSelection {
  /** Selected text exactly as the browser reported it, newlines included. */
  readonly text: string
  /** Viewport x the action centers on. */
  readonly anchorX: number
  /** Viewport y the action sits above. */
  readonly anchorY: number
}

/** Viewport point anchoring one floating action over a selection. */
export interface SelectionAnchor {
  /** Horizontal center of the selection's first visual line. */
  readonly x: number
  /** Top edge of that line. */
  readonly y: number
}

/**
 * Center of the selection's first visual line and that line's top edge. One
 * visual line crossing inline elements reports several rectangles, so every
 * rectangle overlapping the first line is unioned before the center is taken;
 * anchoring to the first rectangle alone would offset the action to the left.
 * @param rects - the range's client rectangles.
 * @returns the anchor point, or undefined when no rectangle has area.
 */
export function selectionAnchor(rects: readonly DOMRect[]): SelectionAnchor | undefined {
  const visible = rects.filter(rect => rect.width > 0 && rect.height > 0)
  const first = visible[0]
  if (first === undefined) return undefined
  let top = first.top
  let bottom = first.bottom
  for (const rect of visible) {
    if (rect.top >= top) continue
    top = rect.top
    bottom = rect.bottom
  }
  let left = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  for (const rect of visible) {
    if (rect.top >= bottom || rect.bottom <= top) continue
    left = Math.min(left, rect.left)
    right = Math.max(right, rect.right)
  }
  return { x: (left + right) / 2, y: top }
}

/**
 * Read the document's current selection when it is a non-blank range inside
 * the conversation transcript this caller owns.
 *
 * The composer chain keeps a hidden fallback composer mounted while a
 * business-owned composer takes over, and a portal escapes that hiding, so a
 * caller that owns one transcript must not answer for a selection in another:
 * two mounted composers would otherwise raise two actions over one selection.
 * @param doc - the document owning the selection.
 * @param scope - this caller's transcript scrollport; a selection outside it is
 * not quotable. An omitted scope accepts a selection in any transcript.
 * @returns the quotable selection, or undefined while the action must stay hidden.
 */
export function readTranscriptSelection(doc: Document, scope?: Element | null): TranscriptSelection | undefined {
  const selection = doc.getSelection()
  if (selection === null || selection.isCollapsed || selection.rangeCount === 0) return undefined
  const text = selection.toString()
  if (text.trim() === '') return undefined
  const range = selection.getRangeAt(0)
  const container = range.commonAncestorContainer
  const element = container.nodeType === ELEMENT_NODE ? container as Element : container.parentElement
  if (element === null) return undefined
  if (scope === undefined || scope === null) {
    if (element.closest(TRANSCRIPT_SELECTOR) === null) return undefined
  } else if (!scope.contains(element)) return undefined
  const anchor = selectionAnchor([...range.getClientRects()])
  if (anchor === undefined) return undefined
  return { text, anchorX: anchor.x, anchorY: anchor.y }
}
