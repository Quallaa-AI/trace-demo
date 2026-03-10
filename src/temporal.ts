// Temporal awareness — compute elapsed time so the model can reason about
// timing without doing arithmetic. This is the core fix for temporal blindness:
// convert temporal reasoning problems into state reasoning problems.
//
// Core principle: inject facts, not interpretations.
//   1. JavaScript computes — elapsed durations, intervals, waiting states
//   2. The prompt presents — pre-computed facts, not raw timestamps
//   3. The model interprets — tone, persistence, urgency, escalation decisions
//
// The code computes temporal state. The prompt presents it as facts.
// The model decides what those facts mean. We never label a response
// as "delayed" or a message pattern as a "burst" — those are judgments
// the model should make from the facts.

import { Message } from './types';

// --- Duration formatting ---

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return '<1m';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function formatTimeAgo(timestamp: string, now: Date): string {
  const ms = now.getTime() - new Date(timestamp).getTime();
  if (ms < 60_000) return 'just now';
  return `${formatDuration(ms)} ago`;
}

// --- Per-message annotation ---
// Every message gets a relative timestamp so the model sees elapsed time
// as natural language, not ISO timestamps it would have to parse.

export function annotateMessages(messages: Message[], now: Date): string {
  return messages.map(m => {
    const ago = formatTimeAgo(m.timestamp, now);
    const role = m.role === 'customer' ? 'Customer' : 'Agent';
    return `[${ago}] ${role}: ${m.content}`;
  }).join('\n');
}

// --- Conversation timing block ---
// Computes aggregate timing signals and returns them as a text block
// for the system prompt. These are the relationships between events —
// the intervals the model would otherwise have to subtract.

export function buildConversationTimingContext(
  messages: Message[],
  now: Date,
  // Signal framing — same temporal fact, different sentence structure.
  // 'passive': third-person observation ("Contact is waiting for your reply")
  // 'directive': second-person awareness ("You are replying Xh after their last message")
  // Demo 5 toggles this to show that framing changes whether the model acts.
  signalFraming: 'passive' | 'directive' = 'passive',
): string {
  if (messages.length === 0) return '';

  const lines: string[] = [];

  // Last message from each side
  const lastCustomer = [...messages].reverse().find(m => m.role === 'customer');
  const lastAgent = [...messages].reverse().find(m => m.role === 'agent');

  if (lastCustomer) {
    lines.push(`Last message from contact: ${formatTimeAgo(lastCustomer.timestamp, now)}`);
  }
  if (lastAgent) {
    lines.push(`Last message from you: ${formatTimeAgo(lastAgent.timestamp, now)}`);
  }

  // Unanswered outbound count
  let unansweredCount = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'agent') unansweredCount++;
    else break;
  }
  if (unansweredCount > 0 && lastCustomer) {
    lines.push(`${unansweredCount} message${unansweredCount > 1 ? 's' : ''} from you since their last reply`);
  }

  // Response gap — who sent the last message and how long ago?
  const lastMsg = messages[messages.length - 1];

  // Delayed response signal — framed based on signalFraming mode
  let delayedResponseLine = '';

  if (lastMsg.role === 'customer' && lastAgent) {
    // Contact sent the last message — compute the gap
    const gapMs = now.getTime() - new Date(lastMsg.timestamp).getTime();
    const gapStr = formatDuration(gapMs);

    if (signalFraming === 'passive') {
      // Third-person observation — states the fact about the contact
      lines.push(`Contact is waiting for your reply (${gapStr})`);
    } else {
      // Second-person directive — addresses the agent directly.
      // Same fact, but framed as self-awareness rather than observation.
      // On a separate line with a label prefix for salience.
      delayedResponseLine = `DELAYED RESPONSE: You are replying ${gapStr} after their last message.`;
    }
  }

  if (lastMsg.role === 'agent' && lastCustomer) {
    // Agent sent the last message — waiting for customer
    const waitMs = now.getTime() - new Date(lastMsg.timestamp).getTime();
    lines.push(`Your last message is unanswered (${formatDuration(waitMs)})`);
  }

  // Contact response latency (last role-switch gap)
  for (let i = messages.length - 1; i > 0; i--) {
    if (messages[i].role !== messages[i - 1].role) {
      const gap = new Date(messages[i].timestamp).getTime() - new Date(messages[i - 1].timestamp).getTime();
      if (messages[i].role === 'customer') {
        lines.push(`Contact's last reply took ${formatDuration(gap)}`);
      }
      break;
    }
  }

  // Message frequency — let the model decide what the pattern means
  const recentCustomer = messages.filter(m =>
    m.role === 'customer' && (now.getTime() - new Date(m.timestamp).getTime()) < 600_000
  );
  if (recentCustomer.length >= 3) {
    lines.push(`${recentCustomer.length} messages from contact in last 10 minutes`);
  }

  // Conversation span
  const first = new Date(messages[0].timestamp);
  const spanMs = now.getTime() - first.getTime();
  lines.push(`Conversation spans ${formatDuration(spanMs)} (${messages.length} messages)`);

  const timingBlock = `--- CONVERSATION TIMING ---\n[${lines.join('. ')}.]`;
  if (delayedResponseLine) {
    return `${timingBlock}\n${delayedResponseLine}`;
  }
  return timingBlock;
}

// --- Current time injection ---

export function buildCurrentTimeContext(now: Date, timezone: string): string {
  const formatted = now.toLocaleString('en-US', {
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  });
  const date = now.toLocaleDateString('en-CA', { timeZone: timezone });

  return `--- CURRENT TIME ---\n[Current local time: ${formatted} (${timezone}). Today's date: ${date}.]`;
}
