// ══════════════════════════════════════════════════════════════
// DEMO 5: Signal Prominence (The Context Engineering Flywheel)
// Presentation: Part 7 — Context Engineering (C)
//
// Run: npm run demo:5
//
// The centerpiece demo. Runs the SAME scenario through Claude twice,
// with two levels of signal prominence:
//
//   Inline:  facts embedded in the timing block (easy to skim past)
//   Callout: same facts, but the response gap gets a prominent ⚠ line
//
// Core principle: inject facts, not interpretations. Both framings
// present the same temporal facts — the difference is prominence.
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
  name: 'signal-prominence-experiment',
  description: 'Customer asked for an afternoon appointment Tuesday evening. Agent replies Thursday morning.',
  expected_response: 'With callout prominence, the agent should acknowledge the response gap.',
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
  console.log(`\n${BOLD}${CYAN}══ DEMO 5: Signal Prominence ══${RESET}\n`);

  // --- Show both presentations ---
  console.log(`${BOLD}${YELLOW}▸ THE TWO PRESENTATIONS${RESET}\n`);

  const inline = buildConversationTimingContext(messagesWithCustomerLast, THURSDAY_NOW, 'inline');
  const callout = buildConversationTimingContext(messagesWithCustomerLast, THURSDAY_NOW, 'callout');

  console.log(`  ${BOLD}Inline (facts embedded):${RESET}`);
  for (const line of inline.split('\n')) {
    console.log(`    ${DIM}${line}${RESET}`);
  }
  console.log('');

  console.log(`  ${BOLD}Callout (response gap highlighted):${RESET}`);
  for (const line of callout.split('\n')) {
    if (line.includes('⚠')) {
      console.log(`  ${GREEN}  ${line}${RESET}`);
    } else {
      console.log(`    ${DIM}${line}${RESET}`);
    }
  }

  // --- Run both through Claude ---
  console.log(`\n${BOLD}${YELLOW}▸ RUNNING BOTH THROUGH CLAUDE...${RESET}\n`);

  console.log(`  ${DIM}Inline prominence...${RESET}`);
  const inlineResult = await runAgent(
    messagesWithCustomerLast, FAUCET_CUSTOMER, THURSDAY_NOW,
    { signalFormat: 'inline' },
  );
  const inlineEval = runEval(scenario, inlineResult.response, 'inline');
  console.log(`  Response: "${inlineResult.response.substring(0, 120)}${inlineResult.response.length > 120 ? '...' : ''}"\n`);

  console.log(`  ${DIM}Callout prominence...${RESET}`);
  const calloutResult = await runAgent(
    messagesWithCustomerLast, FAUCET_CUSTOMER, THURSDAY_NOW,
    { signalFormat: 'callout' },
  );
  const calloutEval = runEval(scenario, calloutResult.response, 'callout');
  console.log(`  Response: "${calloutResult.response.substring(0, 120)}${calloutResult.response.length > 120 ? '...' : ''}"\n`);

  // --- Score differentiation ---
  console.log(`${BOLD}${YELLOW}▸ DIFFERENTIATION SCORE${RESET}\n`);

  const diff = scoreDifferentiation(inlineEval, calloutEval, [
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
  console.log(`  ${BOLD}1.${RESET} Eval exposed the gap     ${DIM}— inline facts got skimmed past${RESET}`);
  console.log(`  ${BOLD}2.${RESET} Identified the fix        ${DIM}— same fact, prominent callout${RESET}`);
  console.log(`  ${BOLD}3.${RESET} Deployed it               ${DIM}— one line added to the timing block${RESET}`);
  console.log(`  ${BOLD}4.${RESET} Eval confirmed it         ${DIM}— callout version acted on the gap${RESET}`);

  console.log(`\n${DIM}  Same facts. Same model. Prominence changed.`);
  console.log(`  That's context engineering — inject facts, not interpretations.${RESET}\n`);
}

main().catch(console.error);
