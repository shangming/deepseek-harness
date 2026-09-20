/**
 * Quote formatting: selected transcript text becomes one Markdown blockquote,
 * and joining it onto the composer draft keeps whatever the user already wrote
 * ahead of the quote.
 * @module @deepseek-ai/dsh-client-ui-message-quote/client/quote
 */

/** Blockquote marker of one quoted line that carries text. */
const QUOTE_PREFIX = '> '

/** A quoted line with no text still carries the blockquote marker. */
const QUOTE_MARKER = '>'

/** Blank line between the quote and the comment the user writes under it. */
const QUOTE_BREAK = '\n\n'

/**
 * Render one selection as a Markdown blockquote. Trailing whitespace leaves
 * every line, and the selection's own leading and trailing blank lines are
 * dropped, so the quote neither opens nor ends with an empty marker.
 * @param text - selected transcript text, newlines included, not blank.
 * @returns the blockquote text without a trailing newline.
 */
export function formatQuote(text: string): string {
  const lines = text.replace(/\r\n?/gu, '\n').split('\n').map(line => line.replace(/\s+$/u, ''))
  let end = lines.length
  while (end > 0 && lines[end - 1] === '') end -= 1
  let start = 0
  while (start < end && lines[start] === '') start += 1
  return lines.slice(start, end)
    .map(line => (line === '' ? QUOTE_MARKER : `${QUOTE_PREFIX}${line}`))
    .join('\n')
}

/**
 * Join a quote onto the composer draft. The blank line under the quote is
 * where the user writes the comment that goes with it, and the caret
 * `setDraft` leaves at the end lands on that line.
 * @param draft - the composer's current draft text.
 * @param quote - blockquote text from {@link formatQuote}, not blank.
 * @returns the next draft.
 */
export function joinQuoteDraft(draft: string, quote: string): string {
  const head = draft.replace(/\s+$/u, '')
  return head === '' ? `${quote}${QUOTE_BREAK}` : `${head}${QUOTE_BREAK}${quote}${QUOTE_BREAK}`
}
