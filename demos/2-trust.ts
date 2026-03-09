// ══════════════════════════════════════════════════════════════
// DEMO 2: Trust Boundaries
// Presentation: Part 3 — Trust Boundaries (T)
//
// Run: npm run demo:2
//
// Each tool is a trust decision. The boundaries are built into
// the handlers — not bolted on after. This demo runs each tool
// against normal and boundary-violating inputs.
// ══════════════════════════════════════════════════════════════

import { TOOLS, clearToolLog } from '../src/tools';
import { FAUCET_CUSTOMER } from '../src/conversation';
import { Contact } from '../src/types';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';

console.log(`\n${BOLD}${CYAN}══ DEMO 2: Trust Boundaries ══${RESET}\n`);

// --- Show the tools and their trust implications ---
console.log(`${BOLD}${YELLOW}▸ THE FOUR TOOLS${RESET}\n`);
for (const tool of TOOLS) {
  console.log(`  ${BOLD}${tool.name}${RESET} — ${tool.description}`);
  console.log(`  ${DIM}Trust: ${tool.trust_implication}${RESET}\n`);
}

// --- Test each boundary ---
console.log(`${BOLD}${YELLOW}▸ BOUNDARY TESTS${RESET}\n`);

const sendSms = TOOLS.find(t => t.name === 'send_sms')!;
const schedule = TOOLS.find(t => t.name === 'schedule_followup')!;

// Normal send
clearToolLog();
let result = sendSms.handler({ message: 'Hi Sarah, just checking in on the faucet repair!' }, FAUCET_CUSTOMER);
console.log(`  ${GREEN}✓${RESET} send_sms (normal): ${result.message}`);

// Opt-out block
clearToolLog();
const optedOutCustomer: Contact = { ...FAUCET_CUSTOMER, opted_out: true };
result = sendSms.handler({ message: 'Hi Sarah!' }, optedOutCustomer);
console.log(`  ${RED}✗${RESET} send_sms (opted-out): ${result.message}`);

// Message too long
clearToolLog();
result = sendSms.handler({ message: 'x'.repeat(500) }, FAUCET_CUSTOMER);
console.log(`  ${RED}✗${RESET} send_sms (too long): ${result.message}`);

// Empty message
clearToolLog();
result = sendSms.handler({ message: '' }, FAUCET_CUSTOMER);
console.log(`  ${RED}✗${RESET} send_sms (empty): ${result.message}`);

// Schedule without reason
clearToolLog();
result = schedule.handler({ scheduled_for: '2026-03-11T09:00:00' }, FAUCET_CUSTOMER);
console.log(`  ${RED}✗${RESET} schedule_followup (no reason): ${result.message}`);

// Schedule with reason
clearToolLog();
result = schedule.handler(
  { scheduled_for: '2026-03-11T09:00:00', reason: 'Check if wife approved the faucet repair' },
  FAUCET_CUSTOMER,
);
console.log(`  ${GREEN}✓${RESET} schedule_followup (with reason): ${result.message}`);

// ✏️ TRY: Add a boundary test — what happens when you schedule 6 follow-ups?
// Uncomment the lines below and re-run:
//
// clearToolLog();
// for (let i = 0; i < 5; i++) {
//   schedule.handler({ scheduled_for: '2026-03-11T09:00:00', reason: `Follow-up #${i + 1}` }, FAUCET_CUSTOMER);
// }
// result = schedule.handler({ scheduled_for: '2026-03-11T09:00:00', reason: 'One too many' }, FAUCET_CUSTOMER);
// console.log(`  ${RED}✗${RESET} schedule_followup (6th attempt): ${result.message}`);

console.log(`\n${DIM}  Every boundary is a trust decision baked into the tool handler.`);
console.log(`  The model never sees these checks — they fire before the action executes.${RESET}\n`);
