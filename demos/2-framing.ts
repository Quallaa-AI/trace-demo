// ══════════════════════════════════════════════════════════════
// DEMO 2: Response Pattern (The Context Engineering Proof)
// Presentation: Part 7 — Context Engineering (C)
//
// Run: npm run demo:2
//
// Same temporal facts, but one version adds a computed comparison:
// how fast the contact replied vs how long your reply has been pending.
//
//   Without: "Last message from contact: 3h ago"
//   With:    + "Contact replied to you in 2m. You have not replied in 3h."
//
// Pure facts. No labels. No directives. The model draws its own conclusion.
// ══════════════════════════════════════════════════════════════

import { runAgent } from '../src/executor';
import { buildConversationTimingContext } from '../src/temporal';
import { scoreDifferentiation, formatDifferentiation } from '../src/eval';
import { FAUCET_MESSAGES, FAUCET_CUSTOMER } from '../src/conversation';
import { Message } from '../src/types';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';

// Sarah described her problem at 2:49 PM. The agent replies at 5:49 PM — 3 hours later.
const THREE_HOURS_LATER = new Date('2026-03-10T17:49:00-07:00');

// Just the first exchange: agent's text-back and customer's problem description.
// The customer asked a question and is waiting for a reply.
const waitingForReply: Message[] = FAUCET_MESSAGES.slice(0, 2);

const diffContext = `Same scenario: a customer described a leaky faucet 3 hours ago and is waiting for a reply. Two versions of temporal context were used.
Response A had basic timing context: elapsed times only ("Last message from contact: 3h ago").
Response B had the same timing context plus a response pattern comparison: "Contact replied to you in 2 minutes. You have not replied in 3 hours." — two factual durations highlighting the asymmetry.
The question: did the response pattern signal cause the agent to behave differently in urgency, action taken, or tone (e.g., acknowledging the delay, apologizing, adjusting approach)?`;

// Extract the SMS content from tool calls — the actual message sent,
// not Claude's narration text.
function extractSmsContent(result: { response: string; tools_called: { tool: string; input: Record<string, unknown> }[] }): string {
  const sms = result.tools_called
    .filter(t => t.tool === 'send_sms')
    .map(t => t.input.message as string)
    .join(' ');
  return sms || result.response;
}

async function main() {
  console.log(`\n${BOLD}${CYAN}══ DEMO 2: Response Pattern ══${RESET}\n`);

  // --- Show both contexts ---
  console.log(`${BOLD}${YELLOW}▸ THE EXPERIMENT${RESET}\n`);
  console.log(`  Same scenario, same data. One adds a computed fact.\n`);

  const without = buildConversationTimingContext(waitingForReply, THREE_HOURS_LATER, false);
  const withPattern = buildConversationTimingContext(waitingForReply, THREE_HOURS_LATER, true);

  console.log(`  ${BOLD}Without response pattern:${RESET}`);
  for (const line of without.split('\n')) {
    console.log(`    ${DIM}${line}${RESET}`);
  }
  console.log('');

  console.log(`  ${BOLD}With response pattern:${RESET}`);
  for (const line of withPattern.split('\n')) {
    if (line.includes('RESPONSE PATTERN') || line.includes('Contact replied')) {
      console.log(`    ${GREEN}${line}${RESET}`);
    } else {
      console.log(`    ${DIM}${line}${RESET}`);
    }
  }

  // --- Run both through Claude ---
  console.log(`\n${BOLD}${YELLOW}▸ RUNNING BOTH THROUGH CLAUDE...${RESET}\n`);

  console.log(`  ${DIM}Without response pattern...${RESET}`);
  const withoutResult = await runAgent(
    waitingForReply, FAUCET_CUSTOMER, THREE_HOURS_LATER,
    { includeResponsePattern: false },
  );
  const withoutSms = extractSmsContent(withoutResult);
  console.log(`  SMS: "${withoutSms.substring(0, 120)}${withoutSms.length > 120 ? '...' : ''}"\n`);

  console.log(`  ${DIM}With response pattern...${RESET}`);
  const withResult = await runAgent(
    waitingForReply, FAUCET_CUSTOMER, THREE_HOURS_LATER,
    { includeResponsePattern: true },
  );
  const withSms = extractSmsContent(withResult);
  console.log(`  SMS: "${withSms.substring(0, 120)}${withSms.length > 120 ? '...' : ''}"\n`);

  // --- Score differentiation ---
  console.log(`${BOLD}${YELLOW}▸ DIFFERENTIATION SCORE${RESET}\n`);

  const diff = await scoreDifferentiation(
    'response-pattern-experiment',
    withoutSms, 'without-pattern',
    withSms, 'with-pattern',
    diffContext,
  );

  console.log(formatDifferentiation(diff));

  // --- The finding ---
  console.log(`\n${BOLD}${YELLOW}▸ THE FINDING${RESET}\n`);
  console.log(`  ${DIM}Same data. Same model. One computed fact added.${RESET}`);
  console.log(`  \x1b[31mWithout:\x1b[0m ${DIM}"Last message from contact: 3h ago"${RESET}`);
  console.log(`  ${GREEN}With:${RESET}    ${DIM}+ "Contact replied to you in 2m. You have not replied in 3h."${RESET}`);
  console.log(`\n  ${BOLD}Inject facts, not interpretations.${RESET}`);
  console.log(`  ${DIM}The model sees two durations and draws its own conclusion.${RESET}`);
  console.log(`  ${DIM}No labels. No directives. Just computed facts.${RESET}\n`);
}

main().catch(console.error);
