// Agent executor — runs a real conversation through Claude.
//
// Takes conversation history + temporal context, calls the model,
// returns the response and any tool calls. Multi-turn tool loop:
// if the model calls tools, we execute them and send results back
// so the model can produce a final text response (max 5 turns).
//
// Note: The multi-turn tool loop below IS scaffolding — the valid kind.
// It extends what the model can do (call tools, gather results, act on them)
// without replacing its judgment about what to do. The anti-pattern is
// scaffolding that overrides context-dependent decisions (fixed cadences,
// exponential back-off for customer follow-ups, etc.).

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { Message, ToolCall, Contact } from './types';
import { annotateMessages, buildConversationTimingContext, buildCurrentTimeContext } from './temporal';
import { TOOLS, getTool, clearToolLog, toolLog } from './tools';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are an AI assistant for Prior Plumbing, a local plumbing company. You handle missed-call recovery, appointment scheduling, and customer follow-ups via text message.

## Your role
- Respond to customer inquiries about plumbing services
- Schedule appointments when customers are ready
- Follow up appropriately when customers go silent
- Escalate emergencies to the on-call plumber

## Tone
- Friendly, professional, concise (this is SMS — keep it short)
- Match urgency to the situation
- Reference the actual conversation, not generic templates

## Scheduling
If a customer wants to book, check availability and propose specific times.
Even for urgent requests, check the calendar first, THEN escalate if needed.

## Follow-ups
When following up after silence:
- Reference what was discussed (don't send generic check-ins)
- Be respectful of their time
- After 2 unanswered follow-ups, send a graceful close and stop

## Escalation
If something is complex or sensitive — escalate to the owner.
If a customer has an urgent issue AND you have calendar tools — check availability and propose times first, THEN escalate if needed.`;

export type ExecutorResult = {
  response: string;
  tools_called: ToolCall[];
  duration_ms: number;
  model: string;
};

export async function runAgent(
  messages: Message[],
  contact: Contact,
  now: Date,
  opts: {
    signalFraming?: 'passive' | 'directive';
    scenario?: string;
    skipTemporalContext?: boolean;
  } = {},
): Promise<ExecutorResult> {
  const signalFraming = opts.signalFraming ?? 'passive';
  const skipTemporal = opts.skipTemporalContext ?? false;

  // Build the full system prompt — with or without temporal context
  let fullSystem: string;
  let conversationBlock: string;

  if (skipTemporal) {
    // Blind mode: raw ISO timestamps, no timing context, no current time.
    // The model sees timestamps but can't do the arithmetic.
    fullSystem = SYSTEM_PROMPT;
    conversationBlock = messages.map(m => {
      const role = m.role === 'customer' ? 'Customer' : 'Agent';
      return `[${m.timestamp}] ${role}: ${m.content}`;
    }).join('\n');
  } else {
    const timeContext = buildCurrentTimeContext(now, contact.timezone);
    const timingContext = buildConversationTimingContext(messages, now, signalFraming);
    fullSystem = [SYSTEM_PROMPT, '', timeContext, '', timingContext].join('\n');
    conversationBlock = annotateMessages(messages, now);
  }

  // Convert conversation to Claude message format
  const claudeMessages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Here is the conversation history:\n\n${conversationBlock}\n\nRespond to the customer's last message (or decide what to do next if you sent the last message). Keep your response SMS-length (under 300 characters). If you decide not to send a message, respond with just "SKIP" followed by your reasoning.`,
    },
  ];

  // Build tool definitions for Claude
  const claudeTools: Anthropic.Tool[] = TOOLS.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: {
      type: 'object' as const,
      properties: toolInputSchemas[t.name] || {},
      required: toolRequiredFields[t.name] || [],
    },
  }));

  clearToolLog();
  const start = Date.now();
  const toolsCalled: ToolCall[] = [];
  let textResponse = '';
  let model = '';
  const MAX_TURNS = 5;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: fullSystem,
      messages: claudeMessages,
      tools: claudeTools,
    });

    model = response.model;

    // Collect text and tool use blocks
    const toolUseBlocks: Anthropic.ToolUseBlock[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        textResponse += block.text;
      } else if (block.type === 'tool_use') {
        toolUseBlocks.push(block);
      }
    }

    // If no tool calls, we're done
    if (toolUseBlocks.length === 0) break;

    // Execute tools and build tool results for next turn
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of toolUseBlocks) {
      const tool = getTool(block.name);
      if (tool) {
        const result = tool.handler(block.input as Record<string, unknown>, contact);
        toolsCalled.push({
          tool: block.name,
          input: block.input as Record<string, unknown>,
          result: result.message,
        });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result.message,
        });
      }
    }

    // Append assistant message + tool results for the next turn
    claudeMessages.push({ role: 'assistant', content: response.content });
    claudeMessages.push({ role: 'user', content: toolResults });

    // If the model signaled end_turn (not tool_use), we're done
    if (response.stop_reason === 'end_turn') break;
  }

  const duration_ms = Date.now() - start;

  return {
    response: textResponse,
    tools_called: toolsCalled,
    duration_ms,
    model,
  };
}

// Tool input schemas for Claude
const toolInputSchemas: Record<string, Record<string, unknown>> = {
  send_sms: {
    message: { type: 'string', description: 'The message to send' },
  },
  schedule_followup: {
    scheduled_for: { type: 'string', description: 'ISO datetime for the follow-up' },
    reason: { type: 'string', description: 'Why this follow-up is being scheduled' },
  },
  check_schedule: {
    contact_phone: { type: 'string', description: 'Phone number to check' },
  },
  cancel_event: {
    event_id: { type: 'string', description: 'ID of the event to cancel' },
  },
};

const toolRequiredFields: Record<string, string[]> = {
  send_sms: ['message'],
  schedule_followup: ['scheduled_for', 'reason'],
  check_schedule: [],
  cancel_event: ['event_id'],
};
