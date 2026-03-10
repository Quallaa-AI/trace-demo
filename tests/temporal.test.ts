import { formatDuration, formatTimeAgo, annotateMessages, buildConversationTimingContext } from '../src/temporal';
import { FAUCET_MESSAGES, TUESDAY_NOW, THURSDAY_NOW } from '../src/conversation';

describe('formatDuration', () => {
  test('under a minute', () => expect(formatDuration(30_000)).toBe('<1m'));
  test('minutes', () => expect(formatDuration(300_000)).toBe('5m'));
  test('hours', () => expect(formatDuration(10_800_000)).toBe('3h'));
  test('days', () => expect(formatDuration(172_800_000)).toBe('2d'));
});

describe('formatTimeAgo', () => {
  const now = new Date('2026-03-10T15:00:00-07:00');

  test('just now', () => {
    expect(formatTimeAgo('2026-03-10T14:59:30-07:00', now)).toBe('just now');
  });

  test('minutes ago', () => {
    expect(formatTimeAgo('2026-03-10T14:50:00-07:00', now)).toBe('10m ago');
  });

  test('hours ago', () => {
    expect(formatTimeAgo('2026-03-10T12:00:00-07:00', now)).toBe('3h ago');
  });
});

describe('annotateMessages', () => {
  test('adds relative timestamps to each message', () => {
    const result = annotateMessages(FAUCET_MESSAGES, TUESDAY_NOW);
    expect(result).toContain('[');
    expect(result).toContain('Customer:');
    expect(result).toContain('Agent:');
  });

  test('timestamps change based on now', () => {
    const tuesday = annotateMessages(FAUCET_MESSAGES, TUESDAY_NOW);
    const thursday = annotateMessages(FAUCET_MESSAGES, THURSDAY_NOW);
    // Tuesday: messages are recent (minutes ago)
    expect(tuesday).toContain('m ago');
    // Thursday: messages are "1d ago" or "2d ago"
    expect(thursday).toContain('ago');
    expect(thursday).not.toContain('just now');
  });
});

describe('buildConversationTimingContext', () => {
  test('includes conversation timing header', () => {
    const result = buildConversationTimingContext(FAUCET_MESSAGES, THURSDAY_NOW);
    expect(result).toContain('--- CONVERSATION TIMING ---');
  });

  test('detects unanswered agent message on Thursday', () => {
    const result = buildConversationTimingContext(FAUCET_MESSAGES, THURSDAY_NOW);
    expect(result).toContain('unanswered');
  });

  test('inline prominence omits response gap callout', () => {
    const withCustomerLast = [...FAUCET_MESSAGES, {
      role: 'customer' as const,
      content: 'Actually, I changed my mind',
      timestamp: '2026-03-10T15:00:00-07:00',
    }];
    const result = buildConversationTimingContext(withCustomerLast, THURSDAY_NOW, 'inline');
    expect(result).not.toContain('⚠');
    // The fact is still present via "Last message from contact"
    expect(result).toContain('Last message from contact');
  });

  test('callout prominence adds ⚠ response gap line', () => {
    const withCustomerLast = [...FAUCET_MESSAGES, {
      role: 'customer' as const,
      content: 'Actually, I changed my mind',
      timestamp: '2026-03-10T15:00:00-07:00',
    }];
    const result = buildConversationTimingContext(withCustomerLast, THURSDAY_NOW, 'callout');
    expect(result).toContain('⚠ Response gap');
    expect(result).toContain('no reply sent');
  });

  test('returns empty string for no messages', () => {
    expect(buildConversationTimingContext([], THURSDAY_NOW)).toBe('');
  });
});
