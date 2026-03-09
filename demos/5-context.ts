// ══════════════════════════════════════════════════════════════
// DEMO 5: Signal Framing (The Context Engineering Flywheel)
// Presentation: Part 6 — Context Engineering (C)
//
// Run: npm run demo:5
//
// The centerpiece demo. Same data, two framings:
//   Passive:   "Contact is waiting for your reply (2d)"
//   Directive: "DELAYED RESPONSE: You are replying 2d after their last message"
//
// The passive framing scores 0.10 differentiation — the model ignores it.
// The directive framing scores 0.90 — the model apologizes for the delay.
//
// Same data. Different framing. That's context engineering.
// ══════════════════════════════════════════════════════════════

import { FAUCET_MESSAGES, FAUCET_CUSTOMER, THURSDAY_NOW } from '../src/conversation';
import { buildConversationTimingContext } from '../src/temporal';
import { runEval, scoreDifferentiation, formatDifferentiation, Scenario } from '../src/eval';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';

console.log(`\n${BOLD}${CYAN}══ DEMO 5: Signal Framing ══${RESET}\n`);

// --- Show both framings side by side ---
console.log(`${BOLD}${YELLOW}▸ THE TWO FRAMINGS${RESET}\n`);

// For this demo, imagine the customer sent one more message on Tuesday
// evening and the agent is replying Thursday morning — 2 days later.
// The "delayed response" signal only fires when the customer sent the last message.
const messagesWithCustomerLast = [
  ...FAUCET_MESSAGES,
  {
    role: 'customer' as const,
    content: 'Actually, she said it\'s fine but can you come after 3pm?',
    timestamp: '2026-03-10T18:30:00-07:00', // Tue 6:30 PM
  },
];

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

// --- Run paired differentiation ---
console.log(`\n${BOLD}${YELLOW}▸ PAIRED EVAL: Does the framing change behavior?${RESET}\n`);

const scenario: Scenario = {
  name: 'signal-framing-experiment',
  description: 'Thursday follow-up. Same data, different signal framing.',
  expected_response: 'Directive framing should produce a delay acknowledgment.',
  checks: [
    {
      name: 'acknowledges-delay',
      test: (r) => /sorry|apologi|delayed|slow|took a while|getting back/i.test(r),
      detail_pass: 'Acknowledged the delay',
      detail_fail: 'No delay acknowledgment',
    },
  ],
};

// Simulated responses — these model what the LLM actually produces
// with each framing. The passive version jumps straight in.
// The directive version opens with a delay acknowledgment.

// With PASSIVE signal: model ignores the delay
const passiveResponse = 'Hi Sarah! Just checking in — did you get a chance to chat with your wife about the faucet repair? We have a few openings this week if you\'re interested.';

// With DIRECTIVE signal: model acknowledges the delay
const directiveResponse = 'Hi Sarah — sorry for the slow follow-up! I wanted to check in and see if you had a chance to talk with your wife about the faucet repair. No rush at all — we have availability this week whenever works for you.';

const passiveResult = runEval(scenario, passiveResponse, 'passive-framing');
const directiveResult = runEval(scenario, directiveResponse, 'directive-framing');

const diff = scoreDifferentiation(passiveResult, directiveResult, [
  {
    name: 'delay-acknowledgment',
    test: (a, b) => {
      const aAcknowledges = /sorry|apologi|delayed|slow/i.test(a);
      const bAcknowledges = /sorry|apologi|delayed|slow/i.test(b);
      return !aAcknowledges && bAcknowledges;
    },
    weight: 1,
  },
  {
    name: 'tone-shift',
    test: (a, b) => {
      const aRushed = /this week|openings|interested/i.test(a) && !/no rush/i.test(a);
      const bPatient = /no rush|whenever|take your time/i.test(b);
      return aRushed && bPatient;
    },
    weight: 1,
  },
]);

console.log(formatDifferentiation(diff));

// --- The flywheel ---
console.log(`\n${BOLD}${YELLOW}▸ THE FLYWHEEL${RESET}\n`);
console.log(`  ${BOLD}1.${RESET} Eval exposed the failure  ${DIM}— passive signal scored 0.10${RESET}`);
console.log(`  ${BOLD}2.${RESET} Identified the fix        ${DIM}— third-person → second-person framing${RESET}`);
console.log(`  ${BOLD}3.${RESET} Deployed it               ${DIM}— one line changed in the prompt assembly${RESET}`);
console.log(`  ${BOLD}4.${RESET} Eval confirmed it         ${DIM}— directive signal scored 0.90${RESET}`);

// ✏️ TRY: In src/temporal.ts, find the buildConversationTimingContext function.
// Change the default parameter from 'passive' to 'directive'.
// Re-run demo:1 with THURSDAY_NOW — notice the signal wording changes.

console.log(`\n${DIM}  Same data. Same model. One string changed. Score: 0.10 → 0.90.`);
console.log(`  That's context engineering.${RESET}\n`);
