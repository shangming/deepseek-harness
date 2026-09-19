// @vitest-environment jsdom
/**
 * ui-message-quote browser half on a real cordis Context with a fake slot
 * declaration, session bindings, and composer facade: the plugin registers the
 * quote action at conversation.input.overlay carrying its own locale namespace
 * and the composer-focus verb, rejects a session it holds no binding for, and
 * reload and disposal withdraw that registration with the plugin fiber (HMR
 * safety). The node half stays inert.
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { apply, inject } from '../src/client/index.ts'
import type { QuoteInjected } from '../src/client/slots.ts'
import { apply as nodeApply } from '../src/index.ts'

const sid = (key: string): SessionId => key as SessionId

/**
 * Boot the plugin over a slot declaration that owns the composer overlay, one
 * bound session, and the composer facade that binding resolves.
 */
async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  ctx.slots.register({
    name: 'root',
    children: { 'conversation.input.overlay': { kind: 'list', scope: 'session' } },
  } as never, (() => null) as never)
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)

  const focus = vi.fn()
  // The plugin resolves the facade through the binding's own scope, which here
  // is the root context holding the composer stub.
  ctx.provide('conversation', { input: { for: () => ({ focus }) } })
  const bindings = new Map<string, unknown>([[sid('s1'), { ctx, session: {} }]])
  ctx.provide('sessions', { binding: (id: SessionId) => bindings.get(id) })

  const fiber = ctx.plugin({ inject: [...inject], apply })
  return {
    ctx,
    locale,
    focus,
    fiber,
    entry: () => {
      const entry = ctx.slots.entries('conversation.input.overlay')[0]
      if (entry === undefined) return undefined
      return {
        ...entry.options,
        locale: entry.locale,
        inject: entry.inject as unknown as ((sessionId: SessionId) => QuoteInjected) | undefined,
      }
    },
  }
}

describe('ui-message-quote browser plugin', () => {
  it('registers the quote action with the documented id, order, and locale', async () => {
    const b = await bench()
    await b.fiber.await()

    expect(b.entry()).toMatchObject({ id: 'message-quote', order: 3, locale: 'quote' })
    expect(b.entry()?.inject).toBeTypeOf('function')
  })

  it('publishes its copy under the quote namespace', async () => {
    const b = await bench()
    await b.fiber.await()

    expect(['引用', 'Quote']).toContain(b.locale.bind('quote')('action.quote'))
  })

  it('focuses the bound session composer through the injected verb', async () => {
    const b = await bench()
    await b.fiber.await()

    b.entry()!.inject!(sid('s1')).focusComposer()

    expect(b.focus).toHaveBeenCalledOnce()
  })

  it('rejects a session it holds no binding for', async () => {
    const b = await bench()
    await b.fiber.await()

    expect(() => b.entry()!.inject!(sid('gone'))).toThrow('session "gone" is unavailable')
  })

  it('withdraws the registration with the plugin fiber', async () => {
    const b = await bench()
    await b.fiber.await()

    await b.fiber.dispose()

    expect(b.ctx.slots.entries('conversation.input.overlay')).toHaveLength(0)
  })

  it('re-registers cleanly when the plugin is reloaded', async () => {
    const b = await bench()
    await b.fiber.await()
    await b.fiber.dispose()

    const reloaded = b.ctx.plugin({ inject: [...inject], apply })
    await reloaded.await()

    expect(b.ctx.slots.entries('conversation.input.overlay')).toHaveLength(1)
    expect(b.entry()).toMatchObject({ id: 'message-quote' })
  })

  it('the node half applies without host-side behavior', () => {
    expect(() => { nodeApply() }).not.toThrow()
  })
})
