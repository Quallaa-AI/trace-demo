# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TRACE framework demo — a TypeScript companion to the "temporal awareness masterclass" for AI agents. Demonstrates how to solve temporal blindness in LLM-based conversational agents by converting timestamp arithmetic into pre-computed facts the model can reason about directly.

Uses the Anthropic SDK (`@anthropic-ai/sdk`) for agent interactions.

## Commands

- **Run demos:** `npm run demo:1` through `npm run demo:6` (each runs a numbered demo via `tsx`)
- **Run tests:** `npm test` (Jest with ts-jest, test root is `tests/`)
- **Run a single test:** `npx jest tests/trust.test.ts`
- **Type check:** `npm run typecheck` (runs `tsc --noEmit`)

## Architecture

The framework implements a layered approach to temporal awareness for conversational AI agents, using a plumbing company customer service scenario as the running example.

### Core Layers (in `src/`)

- **`types.ts`** — Shared types imported by all other files: `Message`, `Contact`, `ToolCall`, `TraceEntry`, `EvalResult`, `DifferentiationResult`
- **`temporal.ts`** — Core temporal fix. Converts raw ISO timestamps into relative durations ("3m ago", "1d ago") and builds structured timing context blocks (who's waiting, burst detection, conversation span). Two signal framings: `passive` vs `directive` — directive framing produces measurably higher differentiation scores in evals.
- **`conversation.ts`** — Test fixtures: the faucet customer story (Sarah Chen, Tuesday afternoon) and burst pipe variant (Mike Torres, Saturday night). All timestamps are absolute so temporal computation can transform them relative to any "now."
- **`tools.ts`** — Four agent tools (`send_sms`, `schedule_followup`, `check_schedule`, `cancel_event`) with trust boundaries built into handlers (opt-out checks, message length caps, duplication limits). Uses an in-memory `toolLog` for test assertions.
- **`enforcement.ts`** — Hard enforcement gates that are never model decisions: opt-out blocking, race condition guards, duplication caps. Pure functions with injectable `now` for testability.
- **`trace.ts`** — Structured trace capture. Combines temporal context + annotated messages + agent response into queryable `TraceEntry` objects.
- **`eval.ts`** — Eval runner with two modes: standard (check properties of a response) and paired differentiation (same scenario, two temporal contexts, score 0–1 on behavioral difference).

### Key Design Principles

- **JavaScript computes, prompt presents, model interprets** — the three-part contract in `temporal.ts`. Code handles arithmetic; the prompt provides facts; the model reasons about tone/urgency.
- **Trust boundaries live in tool handlers**, not in post-hoc validation. The `tools.ts` handlers enforce constraints (opt-out, length, caps) directly.
- **Enforcement vs interpretation** — if violating a rule has legal/financial consequences regardless of context, it goes in `enforcement.ts`. Context-dependent judgment stays with the model.

### Demos (`demos/`)

Numbered 1–6, each maps to a section of the presentation. Run with `npm run demo:N`. Some demos call the Anthropic API and require `ANTHROPIC_API_KEY` in `.env`.

### Tests (`tests/`)

- `trust.test.ts` — Tests tool trust boundaries (send_sms, schedule_followup, cancel_event)
- `enforcement.test.ts` — Tests enforcement gates (opt-out, race guard, duplication cap)
