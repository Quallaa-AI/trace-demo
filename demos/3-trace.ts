// ══════════════════════════════════════════════════════════════
// DEMO 3: Structured Traces
// Presentation: Part 4 — Runtime Observability (R)
//
// Run: npm run demo:3
//
// The agent ran two scenarios: the faucet follow-up (Thursday)
// and the burst pipe (Saturday night). Traces capture what the
// model saw, what it decided, and what tools it called.
//
// Look at the Thursday trace — the agent saw the silence but
// decided NOT to follow up. That's the missed follow-up the
// eval suite needs to catch.
// ══════════════════════════════════════════════════════════════

import { captureTrace, formatTrace } from '../src/trace';
import {
  FAUCET_MESSAGES, FAUCET_CUSTOMER, THURSDAY_NOW,
  BURST_PIPE_MESSAGES, BURST_PIPE_CUSTOMER, SATURDAY_NOW,
} from '../src/conversation';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const CYAN = '\x1b[36m';

console.log(`\n${BOLD}${CYAN}══ DEMO 3: Structured Traces ══${RESET}\n`);

// --- Trace 1: Faucet follow-up (Thursday morning) ---
// The scheduled follow-up fires. The agent sees 42 hours of silence
// after "let me check with my wife" — but decides to SKIP.

const faucetTrace = captureTrace(
  'faucet-thursday-followup',
  FAUCET_MESSAGES,
  FAUCET_CUSTOMER,
  THURSDAY_NOW,
  // This is what the agent actually said (simulated):
  'SKIP — Customer said they would check with their wife. Sending another message after just one day might feel pushy. Will wait for them to reach out.',
  [], // No tools called — that's the problem
  340,
);

console.log(formatTrace(faucetTrace));
console.log('');

// --- Trace 2: Burst pipe (Saturday night) ---
// Emergency. The agent escalates immediately and texts back.

const burstPipeTrace = captureTrace(
  'burst-pipe-emergency',
  BURST_PIPE_MESSAGES,
  BURST_PIPE_CUSTOMER,
  SATURDAY_NOW,
  'I can see this is an emergency — let me get our on-call plumber dispatched to you right away. In the meantime, you did the right thing shutting off the main valve. Can you send me your address?',
  [
    {
      tool: 'send_sms',
      input: { message: 'I can see this is an emergency — let me get our on-call plumber dispatched to you right away.' },
      result: 'Sent to +15559876543',
    },
  ],
  280,
);

console.log(formatTrace(burstPipeTrace));

// --- The point ---
console.log(`${BOLD}${CYAN}▸ WHAT TO NOTICE${RESET}\n`);
console.log(`  The faucet trace shows the agent SKIPPED the follow-up.`);
console.log(`  It saw "unanswered (1d)" and decided not to act.`);
console.log(`  Is that right? The customer said "let me check with my wife" —`);
console.log(`  a next-morning check-in is exactly what a good salesperson would do.\n`);
console.log(`  The burst pipe trace shows immediate action: escalation + text.`);
console.log(`  Same system, same code — different context produces different behavior.\n`);
console.log(`  But how do you catch the faucet failure at scale?`);
console.log(`  You can't read every trace manually. You need automated evals.\n`);
