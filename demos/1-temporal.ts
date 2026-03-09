// ══════════════════════════════════════════════════════════════
// DEMO 1: What the Model Sees
// Presentation: Part 2 — Why This Happens (temporal blindness)
//
// Run: npm run demo:1
//
// This shows the core fix for temporal blindness: raw ISO timestamps
// become human-readable relative durations. The model doesn't need
// to do time math — it gets pre-computed intervals as facts.
// ══════════════════════════════════════════════════════════════

import { FAUCET_MESSAGES, FAUCET_CUSTOMER, TUESDAY_NOW, THURSDAY_NOW } from '../src/conversation';
import { annotateMessages, buildConversationTimingContext, buildCurrentTimeContext } from '../src/temporal';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';

// ✏️ TRY: Change this to THURSDAY_NOW and re-run to see how
// the same conversation looks completely different 48 hours later.
const NOW = TUESDAY_NOW;

console.log(`\n${BOLD}${CYAN}══ DEMO 1: What the Model Sees ══${RESET}\n`);

// --- Raw timestamps (what the model would have to parse) ---
console.log(`${BOLD}${YELLOW}▸ RAW TIMESTAMPS (what the model gets without temporal awareness)${RESET}\n`);
for (const m of FAUCET_MESSAGES) {
  const role = m.role === 'customer' ? 'Customer' : 'Agent';
  console.log(`  ${DIM}${m.timestamp}${RESET}  ${role}: ${m.content}`);
}

console.log(`\n${DIM}  The model sees ISO strings. To know who's waiting and for how long,`);
console.log(`  it would need to parse these, subtract them, and reason about the gaps.${RESET}\n`);

// --- Transformed output (what temporal awareness provides) ---
console.log(`${BOLD}${YELLOW}▸ WITH TEMPORAL AWARENESS (what the model actually sees)${RESET}\n`);
console.log(`  ${DIM}Now: ${NOW.toISOString()}${RESET}\n`);

const annotated = annotateMessages(FAUCET_MESSAGES, NOW);
for (const line of annotated.split('\n')) {
  if (line.includes('Customer:')) {
    console.log(`  ${line}`);
  } else {
    console.log(`  ${DIM}${line}${RESET}`);
  }
}

console.log('');

const timing = buildConversationTimingContext(FAUCET_MESSAGES, NOW);
for (const line of timing.split('\n')) {
  if (line.includes('DELAYED') || line.includes('BURST') || line.includes('unanswered')) {
    console.log(`  ${RED}${line}${RESET}`);
  } else {
    console.log(`  ${BOLD}${line}${RESET}`);
  }
}

const time = buildCurrentTimeContext(NOW, FAUCET_CUSTOMER.timezone);
console.log(`\n  ${BOLD}${time.split('\n')[0]}${RESET}`);
console.log(`  ${time.split('\n')[1]}`);

console.log(`\n${DIM}  Same conversation, same data — but now the model sees elapsed time as`);
console.log(`  facts it can reason about. No timestamp parsing, no subtraction.${RESET}\n`);

// --- The point ---
if (NOW.getTime() === THURSDAY_NOW.getTime()) {
  console.log(`${BOLD}${RED}  ⚠ Notice: "Your last message is unanswered (1d)" — the customer`);
  console.log(`  went silent after "let me check with my wife." It's been over a day.`);
  console.log(`  The model now has a fact it can act on.${RESET}\n`);
}
