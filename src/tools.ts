// Tools — the four tools that give the agent temporal agency.
// Each tool is a trust decision: what can the agent do on its own?
//
// Trust (T) is the architecture: tools as capabilities, handlers as contracts.
// Inside each handler, some checks are enforcement gates (E) — always wrong,
// context-independent — and some are quality gates — good practice.
// Enforcement is a subset of trust, not a separate system.

import { Contact } from './types';

export type ToolInput = Record<string, unknown>;
export type ToolResult = { success: boolean; message: string };
export type ToolHandler = (input: ToolInput, contact: Contact) => ToolResult;

export type ToolDefinition = {
  name: string;
  description: string;
  trust_implication: string;
  handler: ToolHandler;
};

// In-memory log for test assertions — production uses a database.
export const toolLog: { tool: string; input: ToolInput; result: ToolResult }[] = [];

function logAndReturn(name: string, input: ToolInput, result: ToolResult): ToolResult {
  toolLog.push({ tool: name, input, result });
  return result;
}

export function clearToolLog() {
  toolLog.length = 0;
}

// --- Tool definitions ---

export const TOOLS: ToolDefinition[] = [
  {
    name: 'send_sms',
    description: 'Send a text message to the customer',
    trust_implication: 'Can contact customers directly — every message represents the business',
    handler: (input, contact) => {
      const message = String(input.message || '');

      // Enforcement gate: opt-out — legal fines, always wrong
      if (contact.opted_out) {
        return logAndReturn('send_sms', input, {
          success: false,
          message: 'BLOCKED: Contact has opted out',
        });
      }

      // Quality gate: message length cap
      if (message.length > 480) {
        return logAndReturn('send_sms', input, {
          success: false,
          message: 'BLOCKED: Message exceeds 480 characters (SMS limit)',
        });
      }

      // Quality gate: empty message guard
      if (message.trim().length === 0) {
        return logAndReturn('send_sms', input, {
          success: false,
          message: 'BLOCKED: Cannot send empty message',
        });
      }

      return logAndReturn('send_sms', input, {
        success: true,
        message: `Sent to ${contact.phone}: "${message}"`,
      });
    },
  },
  {
    name: 'schedule_followup',
    description: 'Schedule a future follow-up at a specific local time',
    trust_implication: 'Can commit to future actions — the agent decides when to come back',
    handler: (input, contact) => {
      const scheduledFor = String(input.scheduled_for || '');
      const reason = String(input.reason || '');

      // Enforcement gate: opt-out — legal fines, always wrong
      if (contact.opted_out) {
        return logAndReturn('schedule_followup', input, {
          success: false,
          message: 'BLOCKED: Contact has opted out',
        });
      }

      // Quality gate: must have a reason
      if (!reason.trim()) {
        return logAndReturn('schedule_followup', input, {
          success: false,
          message: 'BLOCKED: Follow-up must include a reason',
        });
      }

      // Enforcement gate: max 5 active follow-ups (duplication cap)
      const activeCount = toolLog.filter(
        e => e.tool === 'schedule_followup' && e.result.success
      ).length;
      if (activeCount >= 5) {
        return logAndReturn('schedule_followup', input, {
          success: false,
          message: 'BLOCKED: Maximum 5 active follow-ups per contact',
        });
      }

      return logAndReturn('schedule_followup', input, {
        success: true,
        message: `Scheduled for ${scheduledFor}: "${reason}"`,
      });
    },
  },
  {
    name: 'check_schedule',
    description: 'View all active and recent events for a contact',
    trust_implication: 'Can see the full follow-up state — knows what\'s already planned',
    handler: (input, _contact) => {
      const activeFollowups = toolLog.filter(
        e => e.tool === 'schedule_followup' && e.result.success
      );

      return logAndReturn('check_schedule', input, {
        success: true,
        message: activeFollowups.length > 0
          ? `${activeFollowups.length} active follow-up(s): ${activeFollowups.map(e => e.result.message).join('; ')}`
          : 'No active follow-ups',
      });
    },
  },
  {
    name: 'cancel_event',
    description: 'Cancel a pending scheduled event',
    trust_implication: 'Can undo its own decisions — self-correction without human intervention',
    handler: (input, _contact) => {
      const eventId = String(input.event_id || '');

      if (!eventId.trim()) {
        return logAndReturn('cancel_event', input, {
          success: false,
          message: 'BLOCKED: Must specify event_id to cancel',
        });
      }

      return logAndReturn('cancel_event', input, {
        success: true,
        message: `Cancelled event: ${eventId}`,
      });
    },
  },
];

// Lookup helper
export function getTool(name: string): ToolDefinition | undefined {
  return TOOLS.find(t => t.name === name);
}
