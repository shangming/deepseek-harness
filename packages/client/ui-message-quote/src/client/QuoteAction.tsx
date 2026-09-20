/**
 * The floating quote action: it follows a non-blank text selection inside the
 * conversation transcript and, on click, writes that text into the composer as
 * a Markdown blockquote with a blank line under it for the user's comment. The
 * action renders at the document root, so neither the transcript's scrollport
 * nor the composer card can clip it.
 * @module @deepseek-ai/dsh-client-ui-message-quote/client/QuoteAction
 */

import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { formatQuote, joinQuoteDraft } from './quote.ts'
import {
  owningTranscript, readTranscriptSelection, type TranscriptSelection,
} from './selection.ts'
import type { MessageQuoteProps } from './slots.ts'
import css from './QuoteAction.module.css'

/**
 * The transcript quote action for one Session.
 * @param props - the Session's draft and input actions, the composer-focus verb, and this package's copy.
 * @returns the floating action while a quotable selection exists in this composer's transcript.
 */
export function QuoteAction({ inputActions, useInput, focusComposer, t }: MessageQuoteProps) {
  const draft = useInput(state => state.draft)
  const [selection, setSelection] = useState<TranscriptSelection | null>(null)
  // Marks this composer's place in the document: the action portals out of it,
  // so only this element can name the transcript that belongs to this composer.
  const marker = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const sync = (): void => {
      setSelection(readTranscriptSelection(document, owningTranscript(marker.current)) ?? null)
    }
    // Scrolling and resizing move the selected text without changing the
    // selection, which leaves the recorded viewport anchor stale; the action
    // hides instead of drifting away from the text it would quote.
    const hide = (): void => { setSelection(null) }
    document.addEventListener('selectionchange', sync)
    document.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    sync()
    return () => {
      document.removeEventListener('selectionchange', sync)
      document.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [])

  // A pointer press would collapse the very selection being quoted before the
  // click landed, so the press preserves it.
  const hold = (event: MouseEvent<HTMLButtonElement>): void => { event.preventDefault() }
  const current = selection

  return (
    <>
      <span ref={marker} className={css.marker} aria-hidden="true" />
      {current !== null && createPortal(
        <div className={css.anchor} style={{ left: `${current.anchorX}px`, top: `${current.anchorY}px` }}>
          <Button
            variant="outline"
            size="sm"
            className={css.action}
            onMouseDown={hold}
            onClick={() => {
              inputActions.setDraft(joinQuoteDraft(draft, formatQuote(current.text)))
              focusComposer()
              document.getSelection()?.removeAllRanges()
              setSelection(null)
            }}
          >
            {t('action.quote')}
          </Button>
        </div>,
        document.body,
      )}
    </>
  )
}
