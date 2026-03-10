// ══════════════════════════════════════════════════════════════
// DEMO 0: Temporal Blindness (The Problem)
// Presentation: Part 1 — The Problem
//
// Run: npm run demo:0
//
// Runs both scenarios (faucet follow-up + burst pipe emergency)
// through Claude twice: once WITHOUT temporal context, once WITH.
//
// Without context, the model has raw ISO timestamps it can't do
// arithmetic on. Watch how it handles the faucet follow-up —
// the burst pipe is easy (the message says "HELP"), but knowing
// that Sarah has been silent for 42 hours requires subtraction
// the model can't reliably do.
// ══════════════════════════════════════════════════════════════

import { runAgent } from '../src/executor';
import { scoreDifferentiation, formatDifferentiation } from '../src/eval';
import { runEval, Scenario } from '../src/eval';
import {
  FAUCET_MESSAGES, FAUCET_CUSTOMER, THURSDAY_NOW,
  BURST_PIPE_MESSAGES, BURST_PIPE_CUSTOMER, SATURDAY_NOW,
} from '../src/conversation';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';

// ─── Eval scenarios ──────────────────────────────────────────

const faucetScenario: Scenario = {
  name: 'faucet-followup',
  description: 'Customer said "let me check with my husband" 42 hours ago. Never replied.',
  expected_response: 'Agent should follow up — reference the faucet, gentle tone.',
  checks: [
    {
      name: 'follows-up',
      test: (r) => !r.toLowerCase().startsWith('skip'),
      detail_pass: 'Agent sent a follow-up',
      detail_fail: 'Agent skipped — didn\'t recognize 42h silence',
    },
    {
      name: 'references-conversation',
      test: (r) => /husband|faucet|kitchen|plumb|leak|repair/i.test(r),
      detail_pass: 'References the actual conversation',
      detail_fail: 'Generic or no reference to prior discussion',
    },
  ],
};

const burstScenario: Scenario = {
  name: 'burst-pipe-emergency',
  description: 'Customer texts "HELP my basement is flooding" at 11:32 PM Saturday.',
  expected_response: 'Agent should respond with urgency and take action.',
  checks: [
    {
      name: 'acknowledges-urgency',
      test: (r) => /emergency|urgent|flood|right away|immediately|serious|asap|sorry to hear|oh no/i.test(r),
      detail_pass: 'Acknowledged the urgency',
      detail_fail: 'Treated as routine',
    },
    {
      name: 'actionable',
      test: (r) => /send|dispatch|on-call|come|plumber|address|head over|someone|technician|schedule/i.test(r),
      detail_pass: 'Took or proposed concrete action',
      detail_fail: 'No action taken',
    },
  ],
};

// ─── Differentiation judges ─────────────────────────────────

const differentiators = [
  {
    name: 'urgency-differs',
    test: (faucet: string, burst: string) => {
      const burstUrgent = /emergency|urgent|flood|immediately|asap|right away/i.test(burst);
      const faucetCalm = !/emergency|urgent|immediately|asap|right away/i.test(faucet);
      return burstUrgent && faucetCalm;
    },
    weight: 1,
  },
  {
    name: 'action-differs',
    test: (faucet: string, burst: string) => {
      const burstEscalates = /on-call|dispatch|send|someone|technician/i.test(burst);
      const faucetGentle = /check|husband|faucet|follow|touch base|still interested/i.test(faucet);
      return burstEscalates || faucetGentle;
    },
    weight: 1,
  },
  {
    name: 'tone-differs',
    test: (faucet: string, burst: string) => {
      // Burst pipe should be notably longer/more action-oriented
      // Faucet should be a casual check-in
      const burstHasAction = burst.length > 80 && /!/.test(burst);
      const faucetIsCalm = !/!.*!/.test(faucet); // not multiple exclamation marks
      return burstHasAction && faucetIsCalm;
    },
    weight: 1,
  },
];

async function main() {
  console.log(`\n${BOLD}${CYAN}══ DEMO 0: Temporal Blindness ══${RESET}\n`);

  // ─── Part 1: WITHOUT temporal context ─────────────────────

  console.log(`${BOLD}${RED}▸ WITHOUT TEMPORAL CONTEXT${RESET}`);
  console.log(`${DIM}  The model gets raw ISO timestamps. It can read them but can't`);
  console.log(`  subtract them to know Sarah has been silent for 42 hours.${RESET}\n`);

  console.log(`${DIM}  Running faucet scenario (Thursday 9 AM — 42h after last message)...${RESET}`);
  const blindFaucet = await runAgent(FAUCET_MESSAGES, FAUCET_CUSTOMER, THURSDAY_NOW, {
    skipTemporalContext: true,
  });
  const blindFaucetEval = runEval(faucetScenario, blindFaucet.response, 'blind');

  console.log(`${DIM}  Running burst pipe scenario (Saturday 11:33 PM — 1 min after last message)...${RESET}\n`);
  const blindBurst = await runAgent(BURST_PIPE_MESSAGES, BURST_PIPE_CUSTOMER, SATURDAY_NOW, {
    skipTemporalContext: true,
  });
  const blindBurstEval = runEval(burstScenario, blindBurst.response, 'blind');

  console.log(`  ${BOLD}Faucet (blind):${RESET} "${blindFaucet.response.substring(0, 150)}${blindFaucet.response.length > 150 ? '...' : ''}"`);
  for (const check of blindFaucetEval.checks) {
    const icon = check.passed ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    console.log(`    ${icon} ${check.name}: ${DIM}${check.detail}${RESET}`);
  }
  console.log('');

  console.log(`  ${BOLD}Burst pipe (blind):${RESET} "${blindBurst.response.substring(0, 150)}${blindBurst.response.length > 150 ? '...' : ''}"`);
  for (const check of blindBurstEval.checks) {
    const icon = check.passed ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    console.log(`    ${icon} ${check.name}: ${DIM}${check.detail}${RESET}`);
  }
  console.log('');

  const blindDiff = scoreDifferentiation(blindFaucetEval, blindBurstEval, differentiators);

  console.log(`  ${BOLD}Differentiation:${RESET} ${blindDiff.differentiation_score.toFixed(2)}`);
  for (const line of blindDiff.explanation.split('\n')) {
    console.log(`    ${DIM}${line}${RESET}`);
  }

  // ─── Part 2: WITH temporal context ────────────────────────

  console.log(`\n${BOLD}${GREEN}▸ WITH TEMPORAL CONTEXT${RESET}`);
  console.log(`${DIM}  Same scenarios, same model. Now the model gets pre-computed`);
  console.log(`  timing facts: who's waiting, how long, burst detection.${RESET}\n`);

  console.log(`${DIM}  Running faucet scenario with temporal context...${RESET}`);
  const awarefaucet = await runAgent(FAUCET_MESSAGES, FAUCET_CUSTOMER, THURSDAY_NOW, {
    signalFraming: 'directive',
  });
  const awareFaucetEval = runEval(faucetScenario, awarefaucet.response, 'aware');

  console.log(`${DIM}  Running burst pipe scenario with temporal context...${RESET}\n`);
  const awareBurst = await runAgent(BURST_PIPE_MESSAGES, BURST_PIPE_CUSTOMER, SATURDAY_NOW, {
    signalFraming: 'directive',
  });
  const awareBurstEval = runEval(burstScenario, awareBurst.response, 'aware');

  console.log(`  ${BOLD}Faucet (aware):${RESET} "${awarefaucet.response.substring(0, 150)}${awarefaucet.response.length > 150 ? '...' : ''}"`);
  for (const check of awareFaucetEval.checks) {
    const icon = check.passed ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    console.log(`    ${icon} ${check.name}: ${DIM}${check.detail}${RESET}`);
  }
  console.log('');

  console.log(`  ${BOLD}Burst pipe (aware):${RESET} "${awareBurst.response.substring(0, 150)}${awareBurst.response.length > 150 ? '...' : ''}"`);
  for (const check of awareBurstEval.checks) {
    const icon = check.passed ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    console.log(`    ${icon} ${check.name}: ${DIM}${check.detail}${RESET}`);
  }
  console.log('');

  const awareDiff = scoreDifferentiation(awareFaucetEval, awareBurstEval, differentiators);

  console.log(`  ${BOLD}Differentiation:${RESET} ${awareDiff.differentiation_score.toFixed(2)}`);
  for (const line of awareDiff.explanation.split('\n')) {
    console.log(`    ${DIM}${line}${RESET}`);
  }

  // ─── The point ────────────────────────────────────────────

  console.log(`\n${BOLD}${CYAN}▸ THE POINT${RESET}\n`);
  console.log(`  ${BOLD}Blind differentiation:  ${RED}${blindDiff.differentiation_score.toFixed(2)}${RESET}`);
  console.log(`  ${BOLD}Aware differentiation:  ${GREEN}${awareDiff.differentiation_score.toFixed(2)}${RESET}\n`);

  console.log(`${DIM}  The burst pipe is easy — "HELP my basement is flooding" carries its`);
  console.log(`  own urgency. The model handles it with or without temporal context.`);
  console.log(`  `);
  console.log(`  The faucet is where temporal blindness bites. Without pre-computed`);
  console.log(`  timing facts, the model can't tell that 42 hours of silence after`);
  console.log(`  "let me check with my husband" means it's time to follow up.`);
  console.log(`  `);
  console.log(`  Same model. Same data. The only difference: whether temporal`);
  console.log(`  relationships are pre-computed as facts the model can read.${RESET}\n`);
}

main().catch(console.error);
