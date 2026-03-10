// ══════════════════════════════════════════════════════════════
// DEMO 5: Signal Framing (The Context Engineering Flywheel)
// Presentation: Part 7 — Context Engineering (C)
//
// Run: npm run demo:5
//
// Recreates a real production finding: the delayed-response signal
// went from 0.10 to 0.90 differentiation by rewording alone.
//
// Same temporal fact, two framings:
//   Passive:   "Contact is waiting for your reply (1d)"
//   Directive: "DELAYED RESPONSE: You are replying 1d after their last message"
//
// Same data. Same model. The framing changes whether it acts on it.
// ══════════════════════════════════════════════════════════════

import { runAgent } from '../src/executor';
import { buildConversationTimingContext } from '../src/temporal';
import { runEval, scoreDifferentiation, formatDifferentiation, Scenario } from '../src/eval';
import { FAUCET_MESSAGES, FAUCET_CUSTOMER } from '../src/conversation';
import { Message } from '../src/types';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';

// Sarah described her problem at 2:49 PM. The agent replies at 5:49 PM — 3 hours later.
// A 3h gap in SMS is the sweet spot: long enough to notice, short enough to apologize for.
// This matches the production experiment that found passive→directive went 0.10→0.90.
const THREE_HOURS_LATER = new Date('2026-03-10T17:49:00-07:00');

// Just the first exchange: agent's text-back and customer's problem description.
// The customer asked a question and is waiting for a reply.
const waitingForReply: Message[] = FAUCET_MESSAGES.slice(0, 2);

const DELAY_REGEX = /sorry|apologi|delay|slow|getting back|late|patience|wait/i;

const scenario: Scenario = {
  name: 'signal-framing-experiment',
  description: 'Same delayed response, passive vs directive framing.',
  expected_response: 'Directive framing should trigger delay acknowledgment.',
  checks: [
    {
      name: 'acknowledges-delay',
      test: (r) => DELAY_REGEX.test(r),
      detail_pass: 'Acknowledged the delay',
      detail_fail: 'No delay acknowledgment',
    },
  ],
};

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
  console.log(`\n${BOLD}${CYAN}══ DEMO 5: Signal Framing ══${RESET}\n`);

  // --- Show both framings ---
  console.log(`${BOLD}${YELLOW}▸ THE EXPERIMENT${RESET}\n`);
  console.log(`  Same scenario, same data. One signal reworded.\n`);

  const passive = buildConversationTimingContext(waitingForReply, THREE_HOURS_LATER, 'passive');
  const directive = buildConversationTimingContext(waitingForReply, THREE_HOURS_LATER, 'directive');

  console.log(`  ${BOLD}Passive framing (third-person observation):${RESET}`);
  for (const line of passive.split('\n')) {
    console.log(`    ${DIM}${line}${RESET}`);
  }
  console.log('');

  console.log(`  ${BOLD}Directive framing (second-person awareness):${RESET}`);
  for (const line of directive.split('\n')) {
    if (line.startsWith('DELAYED')) {
      console.log(`    ${GREEN}${line}${RESET}`);
    } else {
      console.log(`    ${DIM}${line}${RESET}`);
    }
  }

  // --- Run both through Claude ---
  console.log(`\n${BOLD}${YELLOW}▸ RUNNING BOTH THROUGH CLAUDE...${RESET}\n`);

  console.log(`  ${DIM}Passive framing...${RESET}`);
  const passiveResult = await runAgent(
    waitingForReply, FAUCET_CUSTOMER, THREE_HOURS_LATER,
    { signalFraming: 'passive' },
  );
  const passiveSms = extractSmsContent(passiveResult);
  const passiveEval = runEval(scenario, passiveSms, 'passive');
  console.log(`  SMS: "${passiveSms.substring(0, 120)}${passiveSms.length > 120 ? '...' : ''}"\n`);

  console.log(`  ${DIM}Directive framing...${RESET}`);
  const directiveResult = await runAgent(
    waitingForReply, FAUCET_CUSTOMER, THREE_HOURS_LATER,
    { signalFraming: 'directive' },
  );
  const directiveSms = extractSmsContent(directiveResult);
  const directiveEval = runEval(scenario, directiveSms, 'directive');
  console.log(`  SMS: "${directiveSms.substring(0, 120)}${directiveSms.length > 120 ? '...' : ''}"\n`);

  // --- Score differentiation ---
  console.log(`${BOLD}${YELLOW}▸ DIFFERENTIATION SCORE${RESET}\n`);

  const diff = scoreDifferentiation(passiveEval, directiveEval, [
    {
      name: 'delay-acknowledgment',
      test: (a, b) => {
        const aAcknowledges = DELAY_REGEX.test(a);
        const bAcknowledges = DELAY_REGEX.test(b);
        return !aAcknowledges && bAcknowledges;
      },
      weight: 1,
    },
    {
      name: 'tone-shift',
      test: (a, b) => {
        const bSofter = /sorry|apologi|patience|getting back/i.test(b);
        const aDirect = !/sorry|apologi|patience|getting back/i.test(a);
        return aDirect && bSofter;
      },
      weight: 1,
    },
  ]);

  console.log(formatDifferentiation(diff));

  // --- The finding ---
  console.log(`\n${BOLD}${YELLOW}▸ THE FINDING${RESET}\n`);
  console.log(`  ${DIM}Same data. Same model. One signal reworded.${RESET}`);
  console.log(`  ${RED}Passive:${RESET}   ${DIM}"Contact is waiting for your reply (3h)"${RESET}  ${DIM}→ observation${RESET}`);
  console.log(`  ${GREEN}Directive:${RESET} ${DIM}"You are replying 3h after their last message"${RESET} ${DIM}→ awareness${RESET}`);
  console.log(`\n  ${BOLD}Address the agent, not the contact.${RESET}`);
  console.log(`  ${DIM}Second-person framing creates awareness. Third-person creates observation.${RESET}\n`);
}

main().catch(console.error);
