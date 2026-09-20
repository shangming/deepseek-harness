// @vitest-environment jsdom
/**
 * Transcript selection reading: the viewport anchor a selection gets, and every
 * case where the floating action must stay hidden — a missing, collapsed, or
 * blank range, text outside the transcript scrollport, and a range with no
 * measurable rectangle.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { owningTranscript, readTranscriptSelection, selectionAnchor, TRANSCRIPT_SELECTOR } from '../src/client/selection.ts'

/** One client rectangle with area. */
const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
  width,
  height,
  x: left,
  y: top,
  toJSON: () => ({}),
}) as DOMRect

/** Append the transcript scrollport holding one paragraph and return it. */
function transcript(text: string): HTMLElement {
  const host = document.createElement('div')
  host.setAttribute('data-conversation-scroll', '')
  const paragraph = document.createElement('p')
  paragraph.textContent = text
  host.append(paragraph)
  document.body.append(host)
  return paragraph
}

/** jsdom ships no client rectangles on Range, so these tests install the measurement a browser provides. */
function stubRects(rects: readonly DOMRect[]): void {
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    writable: true,
    value: () => rects,
  })
}

/** Select one element's contents and report `rects` as the range's client rectangles. */
function select(element: Element, rects: readonly DOMRect[]): Selection {
  const range = document.createRange()
  range.selectNodeContents(element)
  stubRects(rects)
  const selection = document.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
  return selection
}

afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(Range.prototype, 'getClientRects')
  document.body.innerHTML = ''
  document.getSelection()?.removeAllRanges()
})

describe('selectionAnchor', () => {
  it('reports no anchor without a rectangle that has area', () => {
    expect(selectionAnchor([])).toBeUndefined()
    expect(selectionAnchor([rect(10, 10, 0, 0)])).toBeUndefined()
  })

  it('centers on the selection line and sits above its top edge', () => {
    expect(selectionAnchor([rect(100, 50, 40, 20)])).toEqual({ x: 120, y: 50 })
  })

  it('unions the inline fragments of the first visual line', () => {
    expect(selectionAnchor([rect(100, 50, 20, 20), rect(120, 50, 30, 20), rect(150, 50, 10, 20)]))
      .toEqual({ x: 130, y: 50 })
  })

  it('ignores rectangles belonging to later lines', () => {
    expect(selectionAnchor([rect(100, 50, 40, 20), rect(60, 74, 200, 20)])).toEqual({ x: 120, y: 50 })
  })

  it('anchors to the topmost line when rectangles arrive out of order', () => {
    expect(selectionAnchor([rect(60, 74, 200, 20), rect(100, 50, 40, 20)])).toEqual({ x: 120, y: 50 })
  })

  it('skips a zero-area fragment beside a measurable one', () => {
    expect(selectionAnchor([rect(100, 50, 0, 0), rect(100, 50, 40, 20)])).toEqual({ x: 120, y: 50 })
  })
})

describe('owningTranscript', () => {
  it('reports nothing for a composer that has no marker element', () => {
    expect(owningTranscript(null)).toBeNull()
  })

  it('reports nothing for a marker outside a rendered conversation', () => {
    const loose = document.createElement('span')
    document.body.append(loose)

    expect(owningTranscript(loose)).toBeNull()
  })

  it('reports nothing for a conversation that renders no transcript', () => {
    const content = document.createElement('div')
    content.setAttribute('data-conversation-content', '')
    const composer = document.createElement('span')
    content.append(composer)
    document.body.append(content)

    expect(owningTranscript(composer)).toBeNull()
  })

  it('finds the transcript of the conversation owning the marker', () => {
    const content = document.createElement('div')
    content.setAttribute('data-conversation-content', '')
    const scrollport = document.createElement('div')
    scrollport.setAttribute('data-conversation-scroll', '')
    const composer = document.createElement('span')
    content.append(scrollport, composer)
    document.body.append(content)

    expect(owningTranscript(composer)).toBe(scrollport)
  })
})

describe('readTranscriptSelection', () => {
  it('reads a transcript selection with the text and its anchor', () => {
    const paragraph = transcript('hello world')
    select(paragraph, [rect(100, 50, 40, 20)])

    expect(readTranscriptSelection(document)).toEqual({ text: 'hello world', anchorX: 120, anchorY: 50 })
  })

  it('reads a range whose common ancestor is the scrollport element itself', () => {
    const paragraph = transcript('hello world')
    const range = document.createRange()
    range.selectNode(paragraph)
    stubRects([rect(100, 50, 40, 20)])
    const selection = document.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)

    expect(readTranscriptSelection(document)).toEqual({ text: 'hello world', anchorX: 120, anchorY: 50 })
  })

  it('reports nothing for a collapsed range', () => {
    const paragraph = transcript('hello world')
    const range = document.createRange()
    range.setStart(paragraph.firstChild!, 2)
    range.collapse(true)
    const selection = document.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)

    expect(readTranscriptSelection(document)).toBeUndefined()
  })

  it('reports nothing for a blank range inside the transcript', () => {
    const paragraph = transcript('   ')
    select(paragraph, [rect(100, 50, 40, 20)])

    expect(readTranscriptSelection(document)).toBeUndefined()
  })

  it('reports nothing for text outside the transcript scrollport', () => {
    const outside = document.createElement('p')
    outside.textContent = 'sidebar title'
    document.body.append(outside)
    select(outside, [rect(100, 50, 40, 20)])

    expect(readTranscriptSelection(document)).toBeUndefined()
  })

  it('reports nothing when the range has no measurable rectangle', () => {
    const paragraph = transcript('hello world')
    select(paragraph, [])

    expect(readTranscriptSelection(document)).toBeUndefined()
  })

  it('reports nothing when the document holds no selection', () => {
    const doc = { getSelection: () => null } as unknown as Document

    expect(readTranscriptSelection(doc)).toBeUndefined()
  })

  it('reports nothing when a non-collapsed selection holds no range', () => {
    const doc = {
      getSelection: () => ({ isCollapsed: false, rangeCount: 0, toString: () => 'never read' }),
    } as unknown as Document

    expect(readTranscriptSelection(doc)).toBeUndefined()
  })

  it('reports nothing when the selected text node has no parent element', () => {
    const doc = {
      getSelection: () => ({
        isCollapsed: false,
        rangeCount: 1,
        toString: () => 'detached',
        getRangeAt: () => ({
          commonAncestorContainer: { nodeType: 3, parentElement: null },
          getClientRects: () => [rect(0, 0, 10, 10)],
        }),
      }),
    } as unknown as Document

    expect(readTranscriptSelection(doc)).toBeUndefined()
  })

  it('reads a selection inside the transcript the caller owns', () => {
    const paragraph = transcript('hello world')
    const scope = paragraph.closest(TRANSCRIPT_SELECTOR)!
    select(paragraph, [rect(100, 50, 40, 20)])

    expect(readTranscriptSelection(document, scope)).toEqual({ text: 'hello world', anchorX: 120, anchorY: 50 })
  })

  it('reports nothing for a selection outside the transcript the caller owns', () => {
    const paragraph = transcript('hello world')
    const other = document.createElement('div')
    other.setAttribute('data-conversation-scroll', '')
    document.body.append(other)
    select(paragraph, [rect(100, 50, 40, 20)])

    expect(readTranscriptSelection(document, other)).toBeUndefined()
  })
})
