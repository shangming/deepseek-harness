# Agent Note: Quote selected transcript text into the composer

Status: implemented

English | [中文](2026-09-19-transcript-quote-surface.zh.md)

## Problem

Users answer a specific passage of an earlier message: they want to point at it and say what they think about it. The interface offered no way to do that. Selecting that passage and copying it by hand produced a message with no boundary between the quoted text and the answer, and the only structured alternative was the cross-session `@` reference, which snapshots a whole other session and is part of neither the current conversation nor the selected passage.

## Decision

A new client plugin package, [ui-message-quote](../../../../packages/client/ui-message-quote/README.md), contributes one floating action to `conversation.input.overlay`. The action follows a non-blank selection inside the transcript scrollport, and picking it writes the selected text into the composer as a Markdown blockquote with a blank line under it for the user's comment, then returns the keyboard to the composer.

The quote is visible user text. It needs no host service, no Remote, no session event, and no request-time context: the message the user submits carries the quote itself, so the session log reproduces it exactly and the model reads it as text the user wrote. Attribution stays out of the quote, because the user's own comment is what explains why the passage matters.

The action is selection-scoped rather than message-scoped. It reads the document selection and anchors to the first visual line's rectangle union, so any transcript text is quotable — assistant reply, user message, or tool output — without the quote surface depending on a message identity, a message action slot, or a per-message registration. It hides on scroll and resize instead of tracking a moved anchor, because a stale anchor would float away from the text it quotes.

Composer focus rides one injected verb. The public `InputActions` face has no focus operation, so the entry's inject face resolves the session's input facade through its binding (`sessions.binding(sessionId).ctx.get('conversation')?.input.for(actx).focus()`) instead of the plugin reaching for a second writer or the interface focusing the composer by DOM lookup.

## Alternatives considered

**Extend `session-reference` to message granularity.** The resolver already owns untrusted snapshot framing, byte budgets, and spill. It also rejects self-reference, snapshots whole sessions, and injects its result as a separate hidden message — which is the opposite of what a user quoting one paragraph wants: they want their comment and the passage in the same visible message, and they want the passage to stay where they put it.

**Add a Quote entry to the message action strip.** `conversation.chat.assistant-actions` would place a control per finalized assistant message, but a message is not the unit the user selects: the interesting passage is usually a sentence or a code block, and user messages have no action slot at all. A per-message control also cannot express "this paragraph" without a second selection step inside its own dialog.

**A host plugin that injects the quote at `agent/pre-step`.** That would let the interface strip the quote from the visible message and re-add it as context. It buys nothing here: the user's message is the right home for text the user chose, and a hidden copy would make the log and the model request disagree about what the user sent.

**An ad-hoc signature or a new session event for quotes.** A new event type would have to enter the surface's message-producing set and every read path that reconstructs a request, for content that is already expressible as user text.

## Consequences

Users can quote and answer a passage without leaving the composer, and the sender side needs no new protocol. The costs are a new client package and its registration surfaces, and four limits the package README records: the quote is plain text without the original markup, replacing the draft re-serializes reference chips already in it to their clipboard text, the quote carries no attribution, and only pointer selections raise the action.
