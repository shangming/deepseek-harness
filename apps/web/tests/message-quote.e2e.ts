// Web e2e scenario: quoting selected transcript text into the composer.
// Cold-seeds one completed user+assistant pair (zero model calls) and drives a
// real pointer selection across the user bubble: the floating Quote action
// appears above that selection, a pick writes the Markdown blockquote into the
// composer with a blank line under it for the comment, and the keyboard returns
// to the composer. This is the assembled-browser behavior the package's jsdom
// specs cannot substitute for (docs/testing.md snapshot rule).
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import { launchWebScaffold, seedSession, watchConsole, webSnapshotMode, type WebScaffold } from './scaffold.ts'
import { newEnglishPage, saveFailureShot } from './support.ts'

// Borrowed read-only: this scenario needs any settled user+assistant pair, not
// a new recording (message-actions / workspace-management pattern).
const SEED = fileURLToPath(new URL('../../../snapshots/web/seeded-history/session.v3.jsonl', import.meta.url))
const MODE = webSnapshotMode()
const SEED_ID = 'message-quote-web-e2e'

const PROMPT = 'Use the read tool twice in one assistant message: read a.txt and b.txt. Then reply with the single word DONE and stop.'
const COMMENT = 'split these into two calls'

describe('web e2e: quoting a transcript selection into the composer', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>

  beforeAll(async () => {
    scaffold = await launchWebScaffold({})
    await seedSession(scaffold, await readFile(SEED, 'utf8'), SEED_ID)
    browser = await chromium.launch()
    page = await newEnglishPage(browser)
    tripwire = watchConsole(page)
    await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
    const groupRow = page.locator('[role="treeitem"]').first()
    await groupRow.waitFor({ timeout: 15_000 })
    await groupRow.click()
    const sessionRow = page.locator('[role="treeitem"]').nth(1)
    await sessionRow.waitFor({ timeout: 10_000 })
    await sessionRow.click()
    await page.getByText('DONE', { exact: true }).waitFor({ timeout: 15_000 })
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await scaffold?.close()
  })

  /**
   * Drag across one rendered line, the way a user selects it.
   * @param page - page holding the conversation.
   * @param text - exact rendered text to sweep.
   * @returns the swept element's box, for anchoring assertions.
   */
  async function selectText(page: Page, text: string): Promise<{ x: number; y: number; width: number; height: number }> {
    const target = page.getByText(text, { exact: true })
    await target.waitFor({ timeout: 10_000 })
    // A pointer press inside an existing selection starts a text drag in
    // Chromium instead of a new selection, so each sweep starts from none.
    await page.evaluate(() => { window.getSelection()?.removeAllRanges() })
    const box = await target.boundingBox()
    if (box === null) throw new Error(`no layout box for ${JSON.stringify(text)}`)
    await page.mouse.move(box.x + 4, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2, { steps: 12 })
    await page.mouse.up()
    return box
  }

  it.skipIf(MODE === 'record')('raises the quote action over a pointer selection, above the selected line', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-message-quote-action'))
    const box = await selectText(page, PROMPT)

    const action = page.getByRole('button', { name: 'Quote', exact: true })
    await action.waitFor({ state: 'visible', timeout: 10_000 })
    const placement = await action.evaluate((button) => {
      const anchor = button.parentElement
      if (anchor === null) throw new Error('quote action has no anchor element')
      const rect = anchor.getBoundingClientRect()
      return { centerX: rect.left + rect.width / 2, bottom: rect.bottom }
    })
    // Centered over the selected line and lifted above it.
    expect(Math.abs(placement.centerX - (box.x + box.width / 2))).toBeLessThanOrEqual(2)
    expect(placement.bottom).toBeLessThanOrEqual(box.y)

    // A pointer press outside the selected text collapses the selection, and an
    // action with nothing to quote goes away with it.
    const port = await page.locator('[data-conversation-scroll]').first().boundingBox()
    if (port === null) throw new Error('transcript scrollport has no layout box')
    await page.mouse.click(port.x + 20, port.y + port.height * 0.6)
    await expect.poll(() => action.count(), { timeout: 5_000 }).toBe(0)
    expect(tripwire.pageErrors).toEqual([])
  }, 60_000)

  it.skipIf(MODE === 'record')('writes the quote into the composer, returns the keyboard, and keeps the comment under it', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-message-quote-composer'))
    await selectText(page, PROMPT)
    // The bubble wraps, so the sweep covers its first visual line; the contract
    // under test is that the composer carries exactly what was selected.
    const selected = await page.evaluate(() => window.getSelection()?.toString() ?? '')
    expect(selected).toContain('assistant message')
    const quoted = `> ${selected}`

    await page.getByRole('button', { name: 'Quote', exact: true }).click()

    const composer = page.locator('[data-composer-input][contenteditable="true"]').last()
    await expect.poll(() => composer.textContent(), { timeout: 10_000 }).toBe(quoted)
    const focused = await page.evaluate(() =>
      (document.activeElement as HTMLElement | null)?.closest('[data-composer-seat]') !== null)
    expect(focused).toBe(true)
    // The pick consumed the selection it wrote, so no second action remains.
    await expect.poll(() => page.getByRole('button', { name: 'Quote', exact: true }).count()).toBe(0)

    await page.keyboard.type(COMMENT)
    await expect.poll(() => composer.textContent(), { timeout: 10_000 }).toBe(`${quoted}${COMMENT}`)
    expect(tripwire.pageErrors).toEqual([])
  }, 60_000)

  it.skipIf(MODE === 'record')('served the conversation without page errors or warnings', () => {
    expect(tripwire.pageErrors).toEqual([])
    expect(tripwire.warnings).toEqual([])
  })
})
