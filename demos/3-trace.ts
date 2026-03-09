// ══════════════════════════════════════════════════════════════
// DEMO 3: Structured Traces
// Presentation: Part 5 — Runtime Observability (R)
//
// Run: npm run demo:3
//
// Runs the faucet follow-up (Thursday) and burst pipe (Saturday)
// through Claude, captures structured traces of what the model
// saw, what it decided, and what tools it called.
//
// The key question: did the agent follow up with the faucet
// customer, or did it SKIP?
// ══════════════════════════════════════════════════════════════

import { runAgent } from '../src/executor';
import { captureTrace, formatTrace } from '../src/trace';
import {
  FAUCET_MESSAGES, FAUCET_CUSTOMER, THURSDAY_NOW,
  BURST_PIPE_MESSAGES, BURST_PIPE_CUSTOMER, SATURDAY_NOW,
} from '../src/conversation';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';

async function main() {
  console.log(`\n${BOLD}${CYAN}══ DEMO 3: Structured Traces ══${RESET}\n`);

  // --- Trace 1: Faucet follow-up (Thursday morning) ---
  console.log(`${BOLD}${YELLOW}▸ Running faucet follow-up scenario...${RESET}\n`);

  const faucetResult = await runAgent(FAUCET_MESSAGES, FAUCET_CUSTOMER, THURSDAY_NOW, {
    scenario: 'faucet-thursday-followup',
  });

  const faucetTrace = captureTrace(
    'faucet-thursday-followup',
    FAUCET_MESSAGES,
    FAUCET_CUSTOMER,
    THURSDAY_NOW,
    faucetResult.response,
    faucetResult.tools_called,
    faucetResult.duration_ms,
  );

  console.log(formatTrace(faucetTrace));
  console.log('');

  // --- Trace 2: Burst pipe (Saturday night) ---
  console.log(`${BOLD}${YELLOW}▸ Running burst pipe scenario...${RESET}\n`);

  const burstResult = await runAgent(BURST_PIPE_MESSAGES, BURST_PIPE_CUSTOMER, SATURDAY_NOW, {
    scenario: 'burst-pipe-emergency',
  });

  const burstTrace = captureTrace(
    'burst-pipe-emergency',
    BURST_PIPE_MESSAGES,
    BURST_PIPE_CUSTOMER,
    SATURDAY_NOW,
    burstResult.response,
    burstResult.tools_called,
    burstResult.duration_ms,
  );

  console.log(formatTrace(burstTrace));

  // --- The point ---
  console.log(`${BOLD}${CYAN}▸ WHAT TO NOTICE${RESET}\n`);
  console.log(`  Same system, same code — different context produces different behavior.`);
  console.log(`  The trace captures every decision so you can see what happened and why.\n`);
  console.log(`  But how do you catch problems at scale?`);
  console.log(`  You can't read every trace manually. You need automated evals.\n`);
}

main().catch(console.error);
