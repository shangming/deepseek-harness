/** `quote` namespace dictionaries. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'action.quote': '引用',
} satisfies Record<string, string>

/** The quote namespace key union. */
export type MessageQuoteKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The quote surface's copy: the floating action over a transcript selection. */
    quote: MessageQuoteKey
  }
}

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'action.quote': 'Quote',
} satisfies Record<MessageQuoteKey, string>
