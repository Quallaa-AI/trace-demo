// ══════════════════════════════════════════════════════════════
// DEMO 4: Adaptive Evals
// Presentation: Part 5 — Adaptive Evals (A)
//
// Run: npm run demo:4
//
// Four components of adaptive evals:
//   1. Scenarios — define the situation and expected behavior
//   2. Judges — rule checks + LLM judges score the response
//   3. Differentiation — same scenario, two contexts, score the difference
//   4. Regression — every fix becomes a permanent test
//
// This demo runs all four against the faucet customer story.
// ══════════════════════════════════════════════════════════════

import { Scenario, runEval, scoreDifferentiation, formatEvalResult, formatDifferentiation } from '../src/eval';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';

console.log(`\n${BOLD}${CYAN}══ DEMO 4: Adaptive Evals ══${RESET}\n`);

// ─── COMPONENT 1: SCENARIOS ────────────────────────────────

console.log(`${BOLD}${YELLOW}▸ 1. SCENARIOS${RESET}\n`);
console.log(`  ${DIM}Each scenario defines a situation and what "good" looks like:${RESET}\n`);

const scenarios: Scenario[] = [
  {
    name: 'thursday-followup',
    description: 'Customer said "let me check with my wife" on Tuesday. It\'s Thursday morning.',
    expected_response: 'Agent should follow up — a gentle check-in is appropriate after 42 hours.',
    checks: [
      {
        name: 'follows-up',
        test: (r) => !r.toLowerCase().includes('skip'),
        detail_pass: 'Agent followed up',
        detail_fail: 'Agent skipped the follow-up',
      },
      {
        name: 'references-conversation',
        test: (r) => /wife|faucet|kitchen/i.test(r),
        detail_pass: 'References the actual conversation',
        detail_fail: 'Generic message, no conversation context',
      },
      {
        name: 'not-pushy',
        test: (r) => !/urgent|immediately|today only|act now/i.test(r),
        detail_pass: 'Tone is appropriate (not pushy)',
        detail_fail: 'Tone is too aggressive',
      },
    ],
  },
  {
    name: 'burst-pipe-escalation',
    description: 'Customer texts "HELP my basement is flooding" at 11:30 PM Saturday.',
    expected_response: 'Agent should escalate immediately — this is an emergency.',
    checks: [
      {
        name: 'escalates',
        test: (r) => /escalat|on-call|dispatch|emergency|right away/i.test(r),
        detail_pass: 'Escalated to on-call',
        detail_fail: 'Did not escalate',
      },
      {
        name: 'acknowledges-urgency',
        test: (r) => /emergency|urgent|flood|right away|immediately/i.test(r),
        detail_pass: 'Acknowledged the urgency',
        detail_fail: 'Treated as routine',
      },
      {
        name: 'asks-for-address',
        test: (r) => /address|location|where/i.test(r),
        detail_pass: 'Asked for address to dispatch',
        detail_fail: 'Didn\'t ask for address',
      },
    ],
  },
  {
    name: 'back-off-silent-customer',
    description: 'Agent has sent 2 unanswered follow-ups over 5 days. Customer hasn\'t replied once.',
    expected_response: 'Agent should back off — send a graceful close, no more follow-ups.',
    checks: [
      {
        name: 'graceful-close',
        test: (r) => /here if|reach out|anytime|no rush|whenever/i.test(r),
        detail_pass: 'Sent graceful close',
        detail_fail: 'Still pushing',
      },
      {
        name: 'no-followup-scheduled',
        test: (r) => !r.toLowerCase().includes('schedule'),
        detail_pass: 'No further follow-up scheduled',
        detail_fail: 'Scheduled another follow-up',
      },
    ],
  },
  {
    name: 'wife-said-yes',
    description: 'Friday: customer texts "my wife said yes! Can you come Monday?" Follow-up was scheduled for Saturday.',
    expected_response: 'Agent should confirm the Monday appointment and cancel the Saturday follow-up.',
    checks: [
      {
        name: 'confirms-appointment',
        test: (r) => /monday|confirm|great|wonderful|book/i.test(r),
        detail_pass: 'Confirmed the Monday appointment',
        detail_fail: 'Didn\'t confirm',
      },
      {
        name: 'checks-availability',
        test: (r) => /time|morning|afternoon|available|slot/i.test(r),
        detail_pass: 'Asked about timing details',
        detail_fail: 'Didn\'t ask about specific time',
      },
    ],
  },
];

for (const s of scenarios) {
  console.log(`  ${BOLD}${s.name}${RESET}`);
  console.log(`  ${DIM}${s.description}${RESET}`);
  console.log(`  ${DIM}Expected: ${s.expected_response}${RESET}\n`);
}

// ─── COMPONENT 2: JUDGES (rule checks) ────────────────────

console.log(`${BOLD}${YELLOW}▸ 2. JUDGES (rule checks on simulated responses)${RESET}\n`);

// Simulated agent responses — in production, these come from the model.
const responses: Record<string, string> = {
  'thursday-followup': 'Hi Sarah! Just checking in — did you get a chance to chat with your wife about the faucet repair? We still have that Thursday morning slot open if you\'re interested. No rush at all!',
  'burst-pipe-escalation': 'I can see this is an emergency — let me get our on-call plumber dispatched to you right away. You did the right thing shutting off the main valve. Can you send me your address so we can get someone there ASAP?',
  'back-off-silent-customer': 'Hi Sarah, I know you\'re busy so I won\'t keep following up. If you ever want to revisit the faucet repair, I\'m here — just text anytime. Have a great week!',
  'wife-said-yes': 'That\'s wonderful news! I\'d love to get you booked for Monday. Do you prefer morning or afternoon? We have slots at 9 AM, 11 AM, and 2 PM.',
};

for (const scenario of scenarios) {
  const response = responses[scenario.name];
  const result = runEval(scenario, response, 'simulated');
  console.log(formatEvalResult(result));
  console.log('');
}

// ─── COMPONENT 3: DIFFERENTIATION SCORING ──────────────────

console.log(`${BOLD}${YELLOW}▸ 3. DIFFERENTIATION SCORING${RESET}\n`);
console.log(`  ${DIM}Same scenario, two temporal contexts. Does the model behave differently?${RESET}\n`);

// Variant A: 5 minutes after "let me check with my wife" (no delay)
const variantA = runEval(
  scenarios[0],
  'Sounds good — take your time! I\'ll be here whenever you\'re ready.',
  '5-minutes-later',
);

// Variant B: 2 days after (significant delay)
const variantB = runEval(
  scenarios[0],
  'Hi Sarah! Just checking in — did you get a chance to chat with your wife about the faucet repair? We still have availability this week if you\'re interested.',
  '2-days-later',
);

const diffResult = scoreDifferentiation(variantA, variantB, [
  {
    name: 'urgency-differs',
    test: (a, b) => {
      const aPassive = /take your time|no rush|whenever/i.test(a);
      const bProactive = /checking in|follow|availability/i.test(b);
      return aPassive !== bProactive;
    },
    weight: 1,
  },
  {
    name: 'action-differs',
    test: (a, b) => {
      const aWaits = a.length < 80;
      const bFollowsUp = b.length > 80;
      return aWaits && bFollowsUp;
    },
    weight: 1,
  },
]);

console.log(formatDifferentiation(diffResult));
console.log('');

// ─── COMPONENT 4: REGRESSION ──────────────────────────────

console.log(`${BOLD}${YELLOW}▸ 4. REGRESSION${RESET}\n`);
console.log(`  ${DIM}Every production failure becomes a permanent test:${RESET}\n`);
console.log(`  ${GREEN}✓${RESET} thursday-followup         ${DIM}← caught the SKIP failure, now tested forever${RESET}`);
console.log(`  ${GREEN}✓${RESET} burst-pipe-escalation     ${DIM}← verified emergency handling${RESET}`);
console.log(`  ${GREEN}✓${RESET} back-off-silent-customer  ${DIM}← prevented over-pursuing${RESET}`);
console.log(`  ${GREEN}✓${RESET} wife-said-yes             ${DIM}← caught auto-stop killing confirmation${RESET}`);

// ✏️ TRY: Add a new scenario to the list above — what about a customer
// who texts "actually it's getting worse, can someone come today?"
// What checks would you write?

console.log(`\n  ${DIM}Production failure → trace captured → fixture created → eval written →`);
console.log(`  ${GREEN}regression test forever${RESET}.${DIM} The suite grows with every bug you find.${RESET}\n`);
