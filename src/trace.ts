// Structured trace capture — every agent decision becomes visible and queryable.
// Without traces, an emergent cadence is a black box. With traces, you can see
// exactly what the agent saw, what it decided, and what tools it called.
//
// This is especially important when the cadence isn't prescribed: you need to
// see what cadence the agent actually produced.

import { Message, TraceEntry, ToolCall } from './types';
import { annotateMessages, buildConversationTimingContext, buildCurrentTimeContext } from './temporal';
import { Contact } from './types';

export function captureTrace(
  scenario: string,
  messages: Message[],
  contact: Contact,
  now: Date,
  agentResponse: string,
  toolsCalled: ToolCall[],
  durationMs: number,
  signalProminence: 'inline' | 'callout' = 'inline',
): TraceEntry {
  const timingContext = buildConversationTimingContext(messages, now, signalProminence);
  const timeContext = buildCurrentTimeContext(now, contact.timezone);
  const annotated = annotateMessages(messages, now);

  return {
    scenario,
    timestamp: now.toISOString(),
    model_saw: `${timeContext}\n\n${annotated}\n\n${timingContext}`,
    model_decided: agentResponse,
    tools_called: toolsCalled,
    duration_ms: durationMs,
  };
}

// --- Trace formatting for terminal output ---

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const MAGENTA = '\x1b[35m';

export function formatTrace(trace: TraceEntry): string {
  const lines: string[] = [];

  lines.push(`${BOLD}${CYAN}━━━ TRACE: ${trace.scenario} ━━━${RESET}`);
  lines.push(`${DIM}Captured: ${trace.timestamp} (${trace.duration_ms}ms)${RESET}`);
  lines.push('');

  lines.push(`${BOLD}${YELLOW}▸ WHAT THE MODEL SAW${RESET}`);
  for (const line of trace.model_saw.split('\n')) {
    if (line.startsWith('---')) {
      lines.push(`  ${BOLD}${line}${RESET}`);
    } else if (line.includes('⚠') || line.includes('messages from contact in last')) {
      lines.push(`  ${RED}${line}${RESET}`);
    } else if (line.startsWith('[')) {
      lines.push(`  ${DIM}${line}${RESET}`);
    } else {
      lines.push(`  ${line}`);
    }
  }
  lines.push('');

  lines.push(`${BOLD}${GREEN}▸ WHAT THE MODEL DECIDED${RESET}`);
  lines.push(`  ${trace.model_decided}`);
  lines.push('');

  if (trace.tools_called.length > 0) {
    lines.push(`${BOLD}${MAGENTA}▸ TOOLS CALLED${RESET}`);
    for (const tc of trace.tools_called) {
      lines.push(`  ${MAGENTA}${tc.tool}${RESET}(${JSON.stringify(tc.input)})`);
      lines.push(`  ${DIM}→ ${tc.result}${RESET}`);
    }
  } else {
    lines.push(`${BOLD}${MAGENTA}▸ TOOLS CALLED${RESET}`);
    lines.push(`  ${DIM}(none)${RESET}`);
  }

  lines.push(`${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
  return lines.join('\n');
}
