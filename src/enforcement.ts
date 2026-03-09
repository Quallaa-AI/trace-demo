// Enforcement gates — rules that are never model decisions.
//
// The test for whether something belongs in enforcement:
// Is the consequence of violating this rule legal, financial, or
// trust-destroying in a way that's context-independent?
//
// - Opt-out violations carry per-text fines regardless of context → enforcement
// - "Follow-up after reply is always wrong" is context-dependent → interpretation (model decides)
// - Race conditions cause duplicate messages regardless of context → enforcement
//
// Everything here is a pure function with injectable `now` for testability.

import { Contact } from './types';

// --- Opt-out enforcement ---
// Legal requirement. $500–$1,500 per-text fines. Context-independent.

export function isOptedOut(contact: Contact): { blocked: boolean; reason: string } {
  if (contact.opted_out) {
    return { blocked: true, reason: 'Contact has opted out — cannot send messages' };
  }
  return { blocked: false, reason: '' };
}

// --- Race guard ---
// Prevents duplicate follow-up fires. Systems fact, not judgment.

export type ScheduledEvent = {
  id: string;
  contact_phone: string;
  scheduled_for: string; // ISO
  status: 'pending' | 'fired' | 'cancelled';
};

export function isRaceCondition(
  event: ScheduledEvent,
  recentlyFired: ScheduledEvent[],
): { blocked: boolean; reason: string } {
  const duplicate = recentlyFired.find(
    e => e.id !== event.id
      && e.contact_phone === event.contact_phone
      && e.status === 'fired'
      && Math.abs(new Date(e.scheduled_for).getTime() - new Date(event.scheduled_for).getTime()) < 300_000
  );

  if (duplicate) {
    return {
      blocked: true,
      reason: `Race guard: event ${duplicate.id} already fired within 5 minutes`,
    };
  }
  return { blocked: false, reason: '' };
}

// --- Duplication cap ---
// Max active follow-ups per contact. Prevents runaway scheduling.

export function exceedsDuplicationCap(
  contactPhone: string,
  activeEvents: ScheduledEvent[],
  cap = 5,
): { blocked: boolean; reason: string } {
  const activeCount = activeEvents.filter(
    e => e.contact_phone === contactPhone && e.status === 'pending'
  ).length;

  if (activeCount >= cap) {
    return {
      blocked: true,
      reason: `Duplication cap: ${activeCount} active follow-ups (max ${cap})`,
    };
  }
  return { blocked: false, reason: '' };
}

// --- Run all enforcement gates ---

export function runEnforcementGates(
  contact: Contact,
  event: ScheduledEvent | null,
  activeEvents: ScheduledEvent[],
  recentlyFired: ScheduledEvent[],
): { allowed: boolean; blocked_by: string[] } {
  const blocked_by: string[] = [];

  const optOut = isOptedOut(contact);
  if (optOut.blocked) blocked_by.push(optOut.reason);

  if (event) {
    const race = isRaceCondition(event, recentlyFired);
    if (race.blocked) blocked_by.push(race.reason);

    const dup = exceedsDuplicationCap(contact.phone, activeEvents);
    if (dup.blocked) blocked_by.push(dup.reason);
  }

  return {
    allowed: blocked_by.length === 0,
    blocked_by,
  };
}

// --- Formatting ---

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';

export function formatEnforcementResult(
  label: string,
  result: { allowed?: boolean; blocked?: boolean; blocked_by?: string[]; reason?: string },
): string {
  const allowed = result.allowed ?? !result.blocked;
  const icon = allowed ? `${GREEN}✓${RESET}` : `${RED}✗ BLOCKED${RESET}`;
  const reason = result.blocked_by?.join('; ') || result.reason || '';
  return `${icon} ${BOLD}${label}${RESET}${reason ? ` — ${reason}` : ''}`;
}
