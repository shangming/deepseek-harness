/**
 * The props of this package's one entry. The 'conversation.input.overlay' slot
 * is declared and typed by ui-conversation and this package only contributes an
 * entry, so no SlotMap merge lives here; the Session's input face arrives
 * through the scope's standard props and the composer-focus verb through the
 * injected face.
 * @module @deepseek-ai/dsh-client-ui-message-quote/client/slots
 */

import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the ui-conversation SlotMap merge (the overlay entry).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls this package's LocaleNamespaceMap merge (the 'quote' seat).
import type {} from './locales.ts'

/** Injected business face of the transcript quote action. */
export interface QuoteInjected {
  /**
   * Return the keyboard to this Session's composer, whose draft the action
   * just replaced, so the comment can follow the quote without a second click.
   */
  focusComposer: () => void
}

/** Full props of the transcript quote action. */
export type MessageQuoteProps =
  PropsRuntime<'conversation.input.overlay'>
  & InjectFace<QuoteInjected>
  & PropsLocale<'quote'>
