// ══════════════════════════════════════════════════════════════
// DEMO 4: Adaptive Evals
// Presentation: Part 6 — Adaptive Evals (A)
//
// Run: npm run demo:4
//
// Runs four scenarios through Claude and evaluates the real
// responses with rule-based judges. Shows all four eval components:
// scenarios, judges, differentiation scoring, and regression.
// ══════════════════════════════════════════════════════════════

import { runAgent } from '../src/executor';
import { Scenario, runEval, scoreDifferentiation, formatEvalResult, formatDifferentiation } from '../src/eval';
import { Message } from '../src/types';
import {
  FAUCET_MESSAGES, FAUCET_CUSTOMER, THURSDAY_NOW, TUESDAY_NOW,
  BURST_PIPE_MESSAGES, BURST_PIPE_CUSTOMER, SATURDAY_NOW,
} from '../src/conversation';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';

// ─── SCENARIOS ─────────────────────────────────────────────

const scenarios: {
  scenario: Scenario;
  messages: Message[];
  contact: typeof FAUCET_CUSTOMER;
  now: Date;
}[] = [
  {
    scenario: {
      name: 'thursday-followup',
      description: 'Customer said "let me check with my husband" on Tuesday. It\'s Thursday morning.',
      expected_response: 'Agent should follow up — a gentle check-in is appropriate after 42 hours.',
      checks: [
        {
          name: 'follows-up',
          test: (r) => !r.toLowerCase().startsWith('skip'),
          detail_pass: 'Agent sent a follow-up',
          detail_fail: 'Agent skipped the follow-up',
        },
        {
          name: 'references-conversation',
          test: (r) => /husband|faucet|kitchen|plumb/i.test(r),
          detail_pass: 'References the actual conversation',
          detail_fail: 'Generic message, no conversation context',
        },
        {
          name: 'not-pushy',
          test: (r) => !/urgent|immediately|today only|act now|limited/i.test(r),
          detail_pass: 'Tone is appropriate',
          detail_fail: 'Tone is too aggressive',
        },
      ],
    },
    messages: FAUCET_MESSAGES,
    contact: FAUCET_CUSTOMER,
    now: THURSDAY_NOW,
  },
  {
    scenario: {
      name: 'burst-pipe-escalation',
      description: 'Customer texts "HELP my basement is flooding" at 11:30 PM Saturday.',
      expected_response: 'Agent should respond with urgency — this is an emergency.',
      checks: [
        {
          name: 'acknowledges-urgency',
          test: (r) => /emergency|urgent|flood|right away|immediately|serious|asap/i.test(r),
          detail_pass: 'Acknowledged the urgency',
          detail_fail: 'Treated as routine',
        },
        {
          name: 'actionable',
          test: (r) => /address|location|send|dispatch|on-call|come|head over|plumber/i.test(r),
          detail_pass: 'Took or proposed action',
          detail_fail: 'No action taken',
        },
      ],
    },
    messages: BURST_PIPE_MESSAGES,
    contact: BURST_PIPE_CUSTOMER,
    now: SATURDAY_NOW,
  },
  {
    scenario: {
      name: 'back-off-silent-customer',
      description: 'Agent has sent 2 unanswered follow-ups. Customer hasn\'t replied in 5 days.',
      expected_response: 'Agent should back off — graceful close, no more follow-ups.',
      checks: [
        {
          name: 'graceful-close',
          test: (r) => /here if|reach out|anytime|no rush|whenever|hesitate|touch/i.test(r),
          detail_pass: 'Sent graceful close',
          detail_fail: 'Still pushing',
        },
        {
          name: 'not-scheduling-more',
          test: (r) => !r.toLowerCase().startsWith('skip') || /stop|no more|final/i.test(r),
          detail_pass: 'Not scheduling more follow-ups',
          detail_fail: 'Still scheduling follow-ups',
        },
      ],
    },
    messages: [
      ...FAUCET_MESSAGES,
      // Two unanswered follow-ups:
      { role: 'agent' as const, content: 'Hi Sarah! Just checking in — did you get a chance to talk with your husband about the faucet repair?', timestamp: '2026-03-11T09:00:00-07:00' },
      { role: 'agent' as const, content: 'Hi Sarah, just wanted to follow up one more time on the faucet. We have openings this week if you\'re still interested!', timestamp: '2026-03-13T09:00:00-07:00' },
    ],
    contact: FAUCET_CUSTOMER,
    now: new Date('2026-03-15T09:00:00-07:00'), // 5 days later
  },
  {
    scenario: {
      name: 'husband-said-yes',
      description: 'Customer texts "my husband said yes! Can you come Monday?"',
      expected_response: 'Agent should confirm and propose times for Monday.',
      checks: [
        {
          name: 'confirms',
          test: (r) => /monday|great|wonderful|awesome|perfect|book|confirm|glad|fantastic/i.test(r),
          detail_pass: 'Acknowledged the good news',
          detail_fail: 'Didn\'t confirm',
        },
        {
          name: 'proposes-times',
          test: (r) => /time|morning|afternoon|slot|available|prefer|work for you|when/i.test(r),
          detail_pass: 'Asked about timing',
          detail_fail: 'Didn\'t ask about specific time',
        },
      ],
    },
    messages: [
      ...FAUCET_MESSAGES,
      { role: 'customer' as const, content: 'My husband said yes! Can you come Monday?', timestamp: '2026-03-12T15:00:00-07:00' },
    ],
    contact: FAUCET_CUSTOMER,
    now: new Date('2026-03-12T15:01:00-07:00'),
  },
];

// ─── RUN ───────────────────────────────────────────────────

async function main() {
  console.log(`\n${BOLD}${CYAN}══ DEMO 4: Adaptive Evals ══${RESET}\n`);

  // --- Component 1: Scenarios ---
  console.log(`${BOLD}${YELLOW}▸ 1. SCENARIOS${RESET}\n`);
  for (const s of scenarios) {
    console.log(`  ${BOLD}${s.scenario.name}${RESET}`);
    console.log(`  ${DIM}${s.scenario.description}${RESET}`);
    console.log(`  ${DIM}Expected: ${s.scenario.expected_response}${RESET}\n`);
  }

  // --- Component 2: Judges (run real model, eval real responses) ---
  console.log(`${BOLD}${YELLOW}▸ 2. JUDGES (running ${scenarios.length} scenarios through Claude...)${RESET}\n`);

  const results = [];
  for (const s of scenarios) {
    const agentResult = await runAgent(s.messages, s.contact, s.now);
    const evalResult = runEval(s.scenario, agentResult.response, 'live');
    results.push(evalResult);
    console.log(formatEvalResult(evalResult));
    console.log(`  ${DIM}Response: "${agentResult.response.substring(0, 100)}${agentResult.response.length > 100 ? '...' : ''}"${RESET}\n`);
  }

  // --- Component 3: Differentiation scoring ---
  console.log(`${BOLD}${YELLOW}▸ 3. DIFFERENTIATION SCORING${RESET}\n`);
  console.log(`  ${DIM}Same scenario, two temporal contexts. Does the model behave differently?${RESET}\n`);
  console.log(`  ${DIM}Running faucet scenario at 5 minutes vs 2 days...${RESET}\n`);

  // Variant A: 5 minutes after the conversation (too soon to follow up)
  const fiveMinLater = new Date('2026-03-10T14:58:00-07:00');
  const resultA = await runAgent(FAUCET_MESSAGES, FAUCET_CUSTOMER, fiveMinLater);
  const evalA = runEval(scenarios[0].scenario, resultA.response, '5-minutes-later');

  // Variant B: 2 days later (follow-up is appropriate)
  const resultB = await runAgent(FAUCET_MESSAGES, FAUCET_CUSTOMER, THURSDAY_NOW);
  const evalB = runEval(scenarios[0].scenario, resultB.response, '2-days-later');

  const diff = scoreDifferentiation(evalA, evalB, [
    {
      name: 'action-differs',
      test: (a, b) => {
        const aSkips = a.toLowerCase().startsWith('skip') || a.length < 50;
        const bFollows = !b.toLowerCase().startsWith('skip') && b.length > 50;
        return aSkips !== bFollows;
      },
      weight: 1,
    },
    {
      name: 'urgency-differs',
      test: (a, b) => {
        const aPassive = /take your time|no rush|whenever|here when/i.test(a);
        const bProactive = /checking in|follow|wanted to|touch base/i.test(b);
        return aPassive || bProactive;
      },
      weight: 1,
    },
  ]);

  console.log(formatDifferentiation(diff));
  console.log('');

  // --- Component 4: Regression ---
  console.log(`${BOLD}${YELLOW}▸ 4. REGRESSION${RESET}\n`);
  console.log(`  ${DIM}Every scenario above is now a permanent test.${RESET}`);
  console.log(`  ${DIM}Upgrade the model? Run the same scenarios. Same expectations.${RESET}\n`);

  for (const r of results) {
    const icon = r.score >= 0.8 ? `${GREEN}✓${RESET}` : `✗`;
    console.log(`  ${icon} ${r.scenario} ${DIM}— score: ${r.score.toFixed(2)}${RESET}`);
  }

  console.log(`\n  ${DIM}Production failure → trace → fixture → eval → ${GREEN}regression test forever${RESET}.${RESET}\n`);
}

main().catch(console.error);
