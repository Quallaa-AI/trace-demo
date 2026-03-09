// ══════════════════════════════════════════════════════════════
// DEMO 5: Signal Framing (The Context Engineering Flywheel)
// Presentation: Part 7 — Context Engineering (C)
//
// Run: npm run demo:5
//
// The centerpiece demo. Runs the SAME scenario through Claude twice,
// with two different signal framings:
//
//   Passive:   "Contact is waiting for your reply (1d)"
//   Directive: "DELAYED RESPONSE: You are replying 1d after their last message"
//
// Watch whether the model acknowledges the delay. Same data,
// same model, one string different.
// ══════════════════════════════════════════════════════════════

import { runAgent } from '../src/executor';
import { buildConversationTimingContext } from '../src/temporal';
import { runEval, scoreDifferentiation, formatDifferentiation, Scenario } from '../src/eval';
import { FAUCET_MESSAGES, FAUCET_CUSTOMER, THURSDAY_NOW } from '../src/conversation';
import { Message } from '../src/types';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';

// The customer sent one more message Tuesday evening.
// The agent is replying Thursday morning — over a day later.
const messagesWithCustomerLast: Message[] = [
  ...FAUCET_MESSAGES,
  {
    role: 'customer',
    content: 'Actually, she said it\'s fine but can you come after 3pm?',
    timestamp: '2026-03-10T18:30:00-07:00', // Tue 6:30 PM
  },
];

const scenario: Scenario = {
  name: 'signal-framing-experiment',
  description: 'Customer asked for an afternoon appointment Tuesday evening. Agent replies Thursday morning.',
  expected_response: 'With directive framing, the agent should acknowledge the delay.',
  checks: [
    {
      name: 'acknowledges-delay',
      test: (r) => /sorry|apologi|delayed|slow|took a while|getting back|late/i.test(r),
      detail_pass: 'Acknowledged the delay',
      detail_fail: 'No delay acknowledgment',
    },
  ],
};

async function main() {
  console.log(`\n${BOLD}${CYAN}══ DEMO 5: Signal Framing ══${RESET}\n`);

  // --- Show both framings ---
  console.log(`${BOLD}${YELLOW}▸ THE TWO FRAMINGS${RESET}\n`);

  const passive = buildConversationTimingContext(messagesWithCustomerLast, THURSDAY_NOW, 'passive');
  const directive = buildConversationTimingContext(messagesWithCustomerLast, THURSDAY_NOW, 'directive');

  console.log(`  ${BOLD}Passive framing:${RESET}`);
  for (const line of passive.split('\n')) {
    if (line.includes('waiting')) {
      console.log(`  ${RED}  ${line}${RESET}`);
    } else {
      console.log(`    ${DIM}${line}${RESET}`);
    }
  }
  console.log('');

  console.log(`  ${BOLD}Directive framing:${RESET}`);
  for (const line of directive.split('\n')) {
    if (line.includes('DELAYED RESPONSE')) {
      console.log(`  ${GREEN}  ${line}${RESET}`);
    } else {
      console.log(`    ${DIM}${line}${RESET}`);
    }
  }

  // --- Run both through Claude ---
  console.log(`\n${BOLD}${YELLOW}▸ RUNNING BOTH FRAMINGS THROUGH CLAUDE...${RESET}\n`);

  console.log(`  ${DIM}Passive framing...${RESET}`);
  const passiveResult = await runAgent(
    messagesWithCustomerLast, FAUCET_CUSTOMER, THURSDAY_NOW,
    { signalFormat: 'passive' },
  );
  const passiveEval = runEval(scenario, passiveResult.response, 'passive');
  console.log(`  Response: "${passiveResult.response.substring(0, 120)}${passiveResult.response.length > 120 ? '...' : ''}"\n`);

  console.log(`  ${DIM}Directive framing...${RESET}`);
  const directiveResult = await runAgent(
    messagesWithCustomerLast, FAUCET_CUSTOMER, THURSDAY_NOW,
    { signalFormat: 'directive' },
  );
  const directiveEval = runEval(scenario, directiveResult.response, 'directive');
  console.log(`  Response: "${directiveResult.response.substring(0, 120)}${directiveResult.response.length > 120 ? '...' : ''}"\n`);

  // --- Score differentiation ---
  console.log(`${BOLD}${YELLOW}▸ DIFFERENTIATION SCORE${RESET}\n`);

  const diff = scoreDifferentiation(passiveEval, directiveEval, [
    {
      name: 'delay-acknowledgment',
      test: (a, b) => {
        const aAcknowledges = /sorry|apologi|delayed|slow|late|getting back/i.test(a);
        const bAcknowledges = /sorry|apologi|delayed|slow|late|getting back/i.test(b);
        return !aAcknowledges && bAcknowledges;
      },
      weight: 1,
    },
    {
      name: 'tone-shift',
      test: (a, b) => {
        // Directive framing tends to produce more patient, apologetic tone
        const bMoreCareful = /no rush|take your time|whenever|sorry|apologi/i.test(b);
        const aMoreDirect = !/sorry|apologi/i.test(a);
        return aMoreDirect && bMoreCareful;
      },
      weight: 1,
    },
  ]);

  console.log(formatDifferentiation(diff));

  // --- The flywheel ---
  console.log(`\n${BOLD}${YELLOW}▸ THE FLYWHEEL${RESET}\n`);
  console.log(`  ${BOLD}1.${RESET} Eval exposed the failure  ${DIM}— passive signal scored 0.10 in production${RESET}`);
  console.log(`  ${BOLD}2.${RESET} Identified the fix        ${DIM}— third-person → second-person framing${RESET}`);
  console.log(`  ${BOLD}3.${RESET} Deployed it               ${DIM}— one line changed in the prompt assembly${RESET}`);
  console.log(`  ${BOLD}4.${RESET} Eval confirmed it         ${DIM}— directive signal scored 0.90${RESET}`);

  console.log(`\n${DIM}  Same data. Same model. One string changed.`);
  console.log(`  That's context engineering.${RESET}\n`);
}

main().catch(console.error);
