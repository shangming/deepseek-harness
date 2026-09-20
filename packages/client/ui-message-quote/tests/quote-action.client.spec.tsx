// @vitest-environment jsdom
/**
 * QuoteAction rendering and gestures: the action appears over a selection in the
 * transcript that belongs to its own composer and stays away from a selection in
 * another conversation, hides again when the selection is cleared, scrolled
 * away, or the window resizes, and quoting writes the blockquote into the
 * composer, returns the keyboard to it, and drops the selection it consumed.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { QuoteAction } from '../src/client/QuoteAction.tsx'
import { zh } from '../src/client/locales.ts'
import type { MessageQuoteProps } from '../src/client/slots.ts'

const t = makeTranslate(zh, commonZh)

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

/**
 * One rendered conversation: its transcript scrollport plus the composer the
 * action mounts in, both under the content root that scopes the selection.
 */
function conversation(text: string): { readonly content: HTMLElement; readonly paragraph: HTMLElement; readonly composer: HTMLElement } {
  const content = document.createElement('div')
  content.setAttribute('data-conversation-content', '')
  const scrollport = document.createElement('div')
  scrollport.setAttribute('data-conversation-scroll', '')
  const paragraph = document.createElement('p')
  paragraph.textContent = text
  scrollport.append(paragraph)
  const composer = document.createElement('div')
  content.append(scrollport, composer)
  document.body.append(content)
  return { content, paragraph, composer }
}

/** Select one element's contents and report `rects` as its client rectangles. */
function select(element: Element, rects: readonly DOMRect[]): void {
  const range = document.createRange()
  range.selectNodeContents(element)
  // jsdom ships no client rectangles on Range, so the test installs the measurement a browser provides.
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    writable: true,
    value: () => rects,
  })
  const selection = document.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
}

/** Render the action in one conversation's composer over a chosen selection. */
function mount(options: { draft?: string; selected?: boolean; foreign?: boolean; rects?: readonly DOMRect[] } = {}) {
  const own = conversation('quoted text')
  const foreign = conversation('other text')
  if (options.selected !== false) {
    select(options.foreign === true ? foreign.paragraph : own.paragraph, options.rects ?? [rect(100, 50, 60, 20)])
  }
  const setDraft = vi.fn()
  const focusComposer = vi.fn()
  const draft = options.draft ?? ''
  const props = {
    inputActions: { setDraft },
    focusComposer,
    useInput: (select: (state: { draft: string }) => unknown) => select({ draft }),
    t,
  } as unknown as MessageQuoteProps
  const view = render(<QuoteAction {...props} />, { container: own.composer })
  return { ...view, setDraft, focusComposer }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  Reflect.deleteProperty(Range.prototype, 'getClientRects')
  document.body.innerHTML = ''
  document.getSelection()?.removeAllRanges()
})

describe('QuoteAction', () => {
  it('renders no action while the transcript holds no quotable selection', () => {
    mount({ selected: false })

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('appears over this composer transcript selection, anchored to its first line', () => {
    mount()

    const action = screen.getByRole('button')
    expect(action.textContent).toBe(zh['action.quote'])
    expect(action.parentElement?.style.left).toBe('130px')
    expect(action.parentElement?.style.top).toBe('50px')
  })

  it('stays away from a selection in another conversation', () => {
    mount({ foreign: true })

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('writes the quote into the composer, returns the keyboard, and clears the selection', () => {
    const { setDraft, focusComposer } = mount()

    fireEvent.click(screen.getByRole('button'))

    expect(setDraft).toHaveBeenCalledWith('> quoted text\n\n')
    expect(focusComposer).toHaveBeenCalledOnce()
    expect(document.getSelection()?.rangeCount).toBe(0)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('keeps text already in the composer ahead of the quote', () => {
    const { setDraft } = mount({ draft: 'my note' })

    fireEvent.click(screen.getByRole('button'))

    expect(setDraft).toHaveBeenCalledWith('my note\n\n> quoted text\n\n')
  })

  it('keeps the selection when the press starts on the action', () => {
    mount()

    expect(fireEvent.mouseDown(screen.getByRole('button'))).toBe(false)
  })

  it('hides when the transcript scrolls under the recorded anchor', () => {
    mount()

    fireEvent.scroll(document)

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('hides when the window resizes', () => {
    mount()

    fireEvent(window, new Event('resize'))

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('hides when the selection is cleared', () => {
    mount()

    document.getSelection()?.removeAllRanges()
    fireEvent(document, new Event('selectionchange'))

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('follows the document only while it is mounted', () => {
    const { unmount } = mount()

    unmount()
    fireEvent.scroll(document)
    fireEvent(window, new Event('resize'))
    fireEvent(document, new Event('selectionchange'))

    expect(screen.queryByRole('button')).toBeNull()
  })
})
