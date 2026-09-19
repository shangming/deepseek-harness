/**
 * Quote formatting: one selection becomes one Markdown blockquote with the
 * selection's own blank edges dropped, and joining that quote onto the composer
 * draft keeps the user's text ahead of it with the blank comment line under it.
 */
import { describe, expect, it } from 'vitest'
import { formatQuote, joinQuoteDraft } from '../src/client/quote.ts'

describe('formatQuote', () => {
  it('prefixes every line of a multi-line selection', () => {
    expect(formatQuote('first\nsecond')).toBe('> first\n> second')
  })

  it('keeps an interior blank line as a bare marker', () => {
    expect(formatQuote('first\n\nsecond')).toBe('> first\n>\n> second')
  })

  it('drops the selection own leading and trailing blank lines', () => {
    expect(formatQuote('\n\nfirst\n\n')).toBe('> first')
  })

  it('normalizes CRLF and strips trailing whitespace from every line', () => {
    expect(formatQuote('first  \r\n\tsecond\r\n')).toBe('> first\n> \tsecond')
  })

  it('renders a whitespace-only selection as an empty quote', () => {
    expect(formatQuote('   \n\t')).toBe('')
  })
})

describe('joinQuoteDraft', () => {
  it('starts the draft with the quote when the composer is empty', () => {
    expect(joinQuoteDraft('', '> quoted')).toBe('> quoted\n\n')
  })

  it('keeps the user text ahead of the quote', () => {
    expect(joinQuoteDraft('my note', '> quoted')).toBe('my note\n\n> quoted\n\n')
  })

  it('trims the draft trailing whitespace before the quote joins it', () => {
    expect(joinQuoteDraft('my note\n\n  ', '> quoted')).toBe('my note\n\n> quoted\n\n')
  })
})
