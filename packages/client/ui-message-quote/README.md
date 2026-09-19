---
description: "The Web quote surface: select text in the conversation transcript and quote it into the composer as a Markdown blockquote, leaving the blank line where the user writes the comment."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-message-quote

English | [中文](README.zh.md)

## Summary

`dsh-client-ui-message-quote` adds the Web quote surface. Selecting non-blank text inside the conversation transcript raises one floating action above that selection; picking it writes the selected text into the composer as a Markdown blockquote and returns the keyboard to the composer, so the comment the user wants to make follows on the blank line under the quote. The package contributes one entry to the composer overlay slot and needs no Host service, Remote, or session event: the quote reaches the model as ordinary user text in the message the user sends.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use this package"></a>
## Use this package

The source is active whenever the composition mounts this package. Both the floating action and the quote it writes work without Host support.

### Where the action appears

The action follows a non-collapsed, non-blank selection that starts inside the conversation transcript's scrollport (`[data-conversation-scroll]`). The composer, the sidebars, and the shell chrome sit outside that scrollport, so selecting text there raises nothing. Assistant replies, user messages, and tool output are all quotable, because the action reads the selection rather than a message identity.

Each mounted composer answers only for its own conversation's transcript, found through the content root that holds it. The composer chain keeps a hidden fallback composer mounted while a business-owned one takes over, and the action renders at the document root, where that hiding does not reach it; without this scope, one selection would raise one action per mounted composer and a pick could write into a composer the user cannot see.

It is centered above the horizontal union of the rectangles on the selection's first visual line and sits eight pixels above that line. One visual line crossing inline elements reports several rectangles, and the union keeps the action over the text the user actually selected.

The action hides when the selection becomes collapsed or non-quotable, when the transcript scrolls, and when the window resizes. Scrolling and resizing move the selected text without changing the selection, which would leave the recorded viewport anchor behind. A pointer press on the action itself preserves the selection, because that press would otherwise collapse it before the click landed.

### What a pick writes

A pick replaces the composer draft with the quote appended under the text already there, then returns the keyboard to the composer with the caret on the blank line under the quote.

| Selected text | Draft after the pick (empty draft) |
|---|---|
| `first` | `> first` + a blank line |
| `first` then `second` on the next line | `> first`, `> second`, then a blank line |
| `first`, a blank line, then `second` | `> first`, `>`, `> second`, then a blank line |

Every selected line is prefixed with `> `, an interior blank line becomes a bare `>`, and the selection's own leading and trailing blank lines are dropped so the quote neither opens nor ends with an empty marker. Carriage returns normalize to newlines and trailing whitespace leaves every line; leading whitespace stays, so indented code keeps its indentation. Text already in the draft stays above the quote, with its own trailing whitespace trimmed.

The sent message is the quote followed by whatever the user typed under it. Nothing marks it as machine-inserted, and the model receives it the way it receives a blockquote the user typed.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The package contributes the `message-quote` entry (order 3) of `conversation.input.overlay`, the composer card's floating-entry slot, and renders through a portal to the document root so neither the transcript's scrollport nor the composer card can clip the action. The entry's inject face carries one verb, `focusComposer`, which resolves the Session's input facade through the binding that owns the session and calls its `focus()`.

### Source map

| File | Role |
|---|---|
| [`src/client/index.ts`](src/client/index.ts) | plugin body: the overlay registration, the dictionaries, and the inject face |
| [`src/client/QuoteAction.tsx`](src/client/QuoteAction.tsx) | the floating action: selection tracking, anchoring, and the pick |
| [`src/client/selection.ts`](src/client/selection.ts) | document selection reading, transcript scoping, and the viewport anchor |
| [`src/client/quote.ts`](src/client/quote.ts) | blockquote formatting and the draft join |
| [`src/client/slots.ts`](src/client/slots.ts) | entry props and the injected face |
| [`src/client/locales.ts`](src/client/locales.ts) | the `quote` namespace dictionaries |
| — | No runtime invariant companion is published; the plugin owns one slot registration and one dictionary registration, both released by the registering effect, and the browser spec proves the withdrawal. |

### Selection reads and anchoring

`readTranscriptSelection` takes the document's current selection, rejects a missing, collapsed, or blank one, and walks from the range's common ancestor to the transcript scrollport. `selectionAnchor` then unions the rectangles overlapping the first visual line and returns that line's horizontal center and top edge; a range with no rectangle that has area yields no anchor, and the action stays away.

### Composition state

The component holds the current selection anchor and nothing else. The draft it joins comes from the Session input store, which the component reads through the standard `useInput` seat, so a pick always appends under what the composer holds at that moment. The composer focus rides the injected `focusComposer` verb rather than a second writer: the facade is resolved per session through `sessions.binding(sessionId).ctx.get('conversation')?.input.for(actx).focus()`, and an inject call for a session with no binding fails loudly.

### Why no Host plugin exists

The quote is user text. Sending it needs no new session event, no `agent/pre-step` contribution, and no request-time context: the message the user submits already carries it, and replay reproduces it byte for byte from the session log.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these pages when the quote surface is not enough. They move from this entry to the composer shell that renders it.

- [ui-conversation](../ui-conversation/README.md) — declares `conversation.input.overlay` and owns the input facade this package focuses.
- [ui-primitives](../ui-primitives/README.md) — the `Button` control the action renders.
- [Conversation subsystem](../../../docs/subsystems/conversation.md) — the composer shell, its slots, and the input state currency.
- [Client package map](../README.md) — adjacent browser UI packages.

-----

<a id="model-experience"></a>
## Model Experience

### Quoted text in the user's message

#### What the model sees

The quote is part of the user's own message: the selected lines arrive as Markdown blockquote lines (`> text`), followed by the comment the user wrote under them. Nothing marks the quote as inserted by the interface, so it reads exactly like a blockquote the user typed, and the request carries no second message or hidden context.

#### Token effect

The quote costs the tokens of its own text and nothing else. It is ordinary message content, so it stays in history until compaction shadows or summarizes that message; no repeat of the same quote is deduplicated.

#### KV Cache effect

The quoted message is an append-only user message: earlier cacheable history is untouched, and only the new suffix differs between requests.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These limits define the current quote surface. They are current package constraints, not a backlog.

- **Plain text only** — the quote is the selection's text as the browser reports it. Inline code, links, emphasis, tables, and images arrive as their text, without the markup that produced them.
- **The draft is replaced, not edited in place** — the composer's public write path replaces the whole document, so reference chips already in the draft become their clipboard text (`@path`, `@[label](dsh-session:…)`) and lose their chip form. Model-visible content is unchanged, and the insertion merges into one undo step rather than becoming its own.
- **Referenced text is not attributed** — the quote names no message, author, or time, so the model cannot tell where in the conversation it came from; the user's comment carries that context when it matters.
- **Pointer selections only** — the action answers a text selection; there is no keyboard entry point, no shortcut, and no per-message Quote control in the message action strip.
- **A selection without rectangles is unquotable** — the action needs a measurable first line to anchor to, so a selection whose range reports no rectangle raises nothing.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published. The plugin owns one slot registration and one locale dictionary registration, both released by the registering effect, and the browser spec proves both are withdrawn when the owning fiber is disposed, so no second authority exists to check at runtime.
