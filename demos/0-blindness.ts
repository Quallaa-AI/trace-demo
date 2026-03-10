// ══════════════════════════════════════════════════════════════
// DEMO 0: Temporal Blindness (The Problem)
// Presentation: Part 1 — The Problem
//
// Run: npm run demo:0
//
// Runs both scenarios (faucet follow-up + burst pipe emergency)
// through Claude twice: once WITHOUT temporal context, once WITH.
//
// Without temporal context, the model has raw ISO timestamps but
// no current time and no pre-computed durations. Watch how it
// handles the faucet follow-up — the burst pipe is easy (the
// message says "HELP"), but knowing that Sarah has been silent
// for 42 hours requires temporal awareness the model doesn't have.
// ══════════════════════════════════════════════════════════════

import { runAgent } from '../src/executor';
import { scoreDifferentiation } from '../src/eval';
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

// ─── Differentiation context for the LLM judge ──────────────

const faucetDiffContext = `Same scenario: a customer said "let me check with my husband" about a leaky faucet repair 42 hours ago and never replied. It's now Thursday 9 AM.
Response A was generated WITHOUT temporal context — the model had raw ISO timestamps but no current time and no pre-computed durations.
Response B was generated WITH temporal context — the model saw "unanswered for 1d", "last message from contact: 1d ago", current time, etc.
The question: did the temporal context cause the agent to behave differently in urgency, action taken, and tone?`;

async function main() {
  console.log(`\n${BOLD}${CYAN}══ DEMO 0: Temporal Blindness ══${RESET}\n`);

  // ─── Run all four agent calls ──────────────────────────────

  console.log(`${BOLD}${YELLOW}▸ RUNNING SCENARIOS${RESET}`);
  console.log(`${DIM}  Each scenario runs twice: once with raw timestamps (blind),`);
  console.log(`  once with pre-computed timing facts (aware).${RESET}\n`);

  console.log(`${DIM}  Running faucet (blind)...${RESET}`);
  const blindFaucet = await runAgent(FAUCET_MESSAGES, FAUCET_CUSTOMER, THURSDAY_NOW, {
    skipTemporalContext: true,
  });

  console.log(`${DIM}  Running faucet (aware)...${RESET}`);
  const awareFaucet = await runAgent(FAUCET_MESSAGES, FAUCET_CUSTOMER, THURSDAY_NOW);

  console.log(`${DIM}  Running burst pipe (blind)...${RESET}`);
  const blindBurst = await runAgent(BURST_PIPE_MESSAGES, BURST_PIPE_CUSTOMER, SATURDAY_NOW, {
    skipTemporalContext: true,
  });

  console.log(`${DIM}  Running burst pipe (aware)...${RESET}\n`);
  const awareBurst = await runAgent(BURST_PIPE_MESSAGES, BURST_PIPE_CUSTOMER, SATURDAY_NOW);

  // ─── Faucet: blind vs aware ────────────────────────────────

  console.log(`${BOLD}${RED}▸ FAUCET FOLLOW-UP${RESET}`);
  console.log(`${DIM}  Sarah said "let me check with my husband" 42 hours ago. Never replied.${RESET}\n`);

  console.log(`  ${BOLD}Blind:${RESET} "${blindFaucet.response.substring(0, 150)}${blindFaucet.response.length > 150 ? '...' : ''}"`);
  console.log(`  ${BOLD}Aware:${RESET} "${awareFaucet.response.substring(0, 150)}${awareFaucet.response.length > 150 ? '...' : ''}"\n`);

  console.log(`${DIM}  Scoring differentiation (LLM judge)...${RESET}`);
  const faucetDiff = await scoreDifferentiation(
    'faucet-followup',
    blindFaucet.response, 'blind',
    awareFaucet.response, 'aware',
    faucetDiffContext,
  );

  console.log(`  ${BOLD}Differentiation:${RESET} ${GREEN}${faucetDiff.differentiation_score.toFixed(2)}${RESET}`);
  for (const line of faucetDiff.explanation.split('\n')) {
    console.log(`    ${DIM}${line}${RESET}`);
  }

  // ─── Burst pipe: both handle it well ────────────────────────

  console.log(`\n${BOLD}${GREEN}▸ BURST PIPE EMERGENCY${RESET}`);
  console.log(`${DIM}  Mike texted "HELP my basement is flooding" at 11:32 PM Saturday.${RESET}\n`);

  console.log(`  ${BOLD}Blind:${RESET} "${blindBurst.response.substring(0, 150)}${blindBurst.response.length > 150 ? '...' : ''}"`);
  console.log(`  ${BOLD}Aware:${RESET} "${awareBurst.response.substring(0, 150)}${awareBurst.response.length > 150 ? '...' : ''}"`);
  console.log(`\n  ${DIM}The urgency is in the words — temporal context isn't needed here.${RESET}`);

  // ─── The point ────────────────────────────────────────────

  console.log(`\n${BOLD}${CYAN}▸ THE POINT${RESET}\n`);
  console.log(`  ${BOLD}Faucet differentiation (blind vs aware):  ${GREEN}${faucetDiff.differentiation_score.toFixed(2)}${RESET}\n`);

  console.log(`${DIM}  The burst pipe is easy — "HELP my basement is flooding" carries its`);
  console.log(`  own urgency. Temporal context doesn't change much.`);
  console.log(`  `);
  console.log(`  The faucet is where temporal blindness bites. Without pre-computed`);
  console.log(`  timing facts, the model can't tell that 42 hours of silence after`);
  console.log(`  "let me check with my husband" means it's time to follow up.`);
  console.log(`  `);
  console.log(`  Same model. Same data. The only difference: whether temporal`);
  console.log(`  relationships are pre-computed as facts the model can read.`);
  console.log(`  `);
  console.log(`  Research confirms this pattern:`);
  console.log(`  • TicToc (2025): Without explicit timestamps, LLM agents perform`);
  console.log(`    "similarly to random guessing" — timestamps appear in <4% of traces`);
  console.log(`  • Real-Time Deadlines (2026): Pre-computed time updates boosted`);
  console.log(`    deal closure from 4% to 32% — zero model changes${RESET}\n`);
}

main().catch(console.error);
