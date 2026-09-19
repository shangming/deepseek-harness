/**
 * Message quote surface plugin, browser half: the floating quote action over a
 * non-blank selection inside the conversation transcript, which writes the
 * selected text into the composer as a Markdown blockquote followed by the
 * blank line where the user writes the comment that goes with it.
 * @module @deepseek-ai/dsh-client-ui-message-quote/client
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
// Type-only: pulls the Session Controller service merge (ctx.sessions).
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the ui-conversation SlotMap merge (the overlay entry) and the Conversation service.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the SlotRegistry service merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { QuoteAction } from './QuoteAction.tsx'
import { en, zh } from './locales.ts'
import type { QuoteInjected } from './slots.ts'

export type { MessageQuoteKey } from './locales.ts'
export type { SelectionAnchor, TranscriptSelection } from './selection.ts'
export type { MessageQuoteProps, QuoteInjected } from './slots.ts'

/** Dictionary namespace owned by this plugin. */
const NS = 'quote'

/** Required services: the slot registry, the copy, the session bindings, and the composer facade. */
export const inject = ['slots', 'locale', 'sessions', 'conversation']

/**
 * Client plugin body: the transcript quote action in the composer overlay.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-message-quote: dictionaries')

  const sessions = ctx.sessions
  ctx.slots.inject('conversation.input.overlay', () => ctx.slots.register({
    name: 'conversation.input.overlay',
    id: 'message-quote',
    order: 3,
    locale: NS,
    inject: (sessionId: SessionId): QuoteInjected => {
      const binding = sessions.binding(sessionId)
      if (binding === undefined) throw new Error(`ui-message-quote: session "${sessionId}" is unavailable`)
      return {
        focusComposer: () => { binding.ctx.get('conversation')?.input.for(binding.ctx).focus() },
      }
    },
  }, QuoteAction))
}
