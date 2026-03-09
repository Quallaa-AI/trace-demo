// ══════════════════════════════════════════════════════════════
// DEMO 6: Enforcement Gates
// Presentation: Part 7 — Enforcement (E)
//
// Run: npm run demo:6
//
// Enforcement gates are rules that NEVER become model decisions.
// The test: is the consequence legal, financial, or trust-destroying
// in a way that's context-independent?
//
// Opt-out = enforcement (per-text fines).
// "Should I follow up after a reply?" = interpretation (model decides).
// ══════════════════════════════════════════════════════════════

import {
  isOptedOut, isRaceCondition, exceedsDuplicationCap,
  runEnforcementGates, formatEnforcementResult,
  ScheduledEvent,
} from '../src/enforcement';
import { FAUCET_CUSTOMER, BURST_PIPE_CUSTOMER } from '../src/conversation';
import { Contact } from '../src/types';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';

console.log(`\n${BOLD}${CYAN}══ DEMO 6: Enforcement Gates ══${RESET}\n`);

// --- Opt-out: legal enforcement ---
console.log(`${BOLD}${YELLOW}▸ OPT-OUT (legal — $500–$1,500 per text)${RESET}\n`);

console.log(formatEnforcementResult(
  'Sarah Chen (active)',
  isOptedOut(FAUCET_CUSTOMER),
));

const stoppedCustomer: Contact = { ...FAUCET_CUSTOMER, name: 'Sarah Chen (STOP)', opted_out: true };
console.log(formatEnforcementResult(
  'Sarah Chen (opted out)',
  isOptedOut(stoppedCustomer),
));
console.log('');

// --- Race guard: systems enforcement ---
console.log(`${BOLD}${YELLOW}▸ RACE GUARD (prevents duplicate fires)${RESET}\n`);

const event: ScheduledEvent = {
  id: 'evt-001',
  contact_phone: '+15551234567',
  scheduled_for: '2026-03-12T09:00:00Z',
  status: 'pending',
};

const noRecentFires: ScheduledEvent[] = [];
console.log(formatEnforcementResult(
  'First fire (no recent activity)',
  isRaceCondition(event, noRecentFires),
));

const recentFire: ScheduledEvent[] = [{
  id: 'evt-000',
  contact_phone: '+15551234567',
  scheduled_for: '2026-03-12T09:01:00Z',
  status: 'fired',
}];
console.log(formatEnforcementResult(
  'Duplicate fire (another event fired 1 min ago)',
  isRaceCondition(event, recentFire),
));
console.log('');

// --- Duplication cap: systems enforcement ---
console.log(`${BOLD}${YELLOW}▸ DUPLICATION CAP (max 5 active follow-ups)${RESET}\n`);

const threeActive: ScheduledEvent[] = Array.from({ length: 3 }, (_, i) => ({
  id: `evt-${i}`,
  contact_phone: '+15551234567',
  scheduled_for: `2026-03-1${3 + i}T09:00:00Z`,
  status: 'pending' as const,
}));
console.log(formatEnforcementResult(
  '3 active follow-ups',
  exceedsDuplicationCap('+15551234567', threeActive),
));

const fiveActive: ScheduledEvent[] = Array.from({ length: 5 }, (_, i) => ({
  id: `evt-${i}`,
  contact_phone: '+15551234567',
  scheduled_for: `2026-03-1${3 + i}T09:00:00Z`,
  status: 'pending' as const,
}));
console.log(formatEnforcementResult(
  '5 active follow-ups (at cap)',
  exceedsDuplicationCap('+15551234567', fiveActive),
));
console.log('');

// --- The full gate stack ---
console.log(`${BOLD}${YELLOW}▸ FULL ENFORCEMENT STACK${RESET}\n`);

const fullResult = runEnforcementGates(FAUCET_CUSTOMER, event, threeActive, noRecentFires);
console.log(formatEnforcementResult('Sarah (normal)', fullResult));

const blockedResult = runEnforcementGates(stoppedCustomer, event, fiveActive, recentFire);
console.log(formatEnforcementResult('Sarah (opted out + at cap + race)', blockedResult));
console.log('');

// --- Enforcement vs. interpretation ---
console.log(`${BOLD}${YELLOW}▸ ENFORCEMENT vs. INTERPRETATION${RESET}\n`);
console.log(`  ${RED}Enforcement (code decides):${RESET}`);
console.log(`    • Opt-out → block               ${DIM}$500–$1,500 per-text fines${RESET}`);
console.log(`    • Race guard → block             ${DIM}duplicate messages regardless of context${RESET}`);
console.log(`    • Duplication cap → block         ${DIM}runaway scheduling${RESET}`);
console.log('');
console.log(`  ${GREEN}Interpretation (model decides):${RESET}`);
console.log(`    • Follow up after reply?          ${DIM}"my wife said yes" ≠ "ok thanks"${RESET}`);
console.log(`    • How persistent to be?           ${DIM}depends on conversation context${RESET}`);
console.log(`    • What tone to use?               ${DIM}depends on elapsed time and urgency${RESET}`);

// ✏️ TRY: What if you lower the duplication cap to 3? Change the cap
// parameter in src/enforcement.ts and re-run — the "3 active" case
// will now be blocked too.

console.log(`\n${DIM}  The test: is the consequence legal, financial, or trust-destroying`);
console.log(`  in a way that's context-independent? If yes → enforcement.`);
console.log(`  If it depends on context → interpretation → model decides.${RESET}\n`);
