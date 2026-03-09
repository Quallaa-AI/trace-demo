import { TOOLS, clearToolLog } from '../src/tools';
import { FAUCET_CUSTOMER } from '../src/conversation';
import { Contact } from '../src/types';

const sendSms = TOOLS.find(t => t.name === 'send_sms')!;
const schedule = TOOLS.find(t => t.name === 'schedule_followup')!;
const checkSchedule = TOOLS.find(t => t.name === 'check_schedule')!;
const cancelEvent = TOOLS.find(t => t.name === 'cancel_event')!;

beforeEach(() => clearToolLog());

describe('send_sms boundaries', () => {
  test('allows normal message', () => {
    const result = sendSms.handler({ message: 'Hi Sarah!' }, FAUCET_CUSTOMER);
    expect(result.success).toBe(true);
  });

  test('blocks opted-out contact', () => {
    const opted: Contact = { ...FAUCET_CUSTOMER, opted_out: true };
    const result = sendSms.handler({ message: 'Hi!' }, opted);
    expect(result.success).toBe(false);
    expect(result.message).toContain('opted out');
  });

  test('blocks message over 480 chars', () => {
    const result = sendSms.handler({ message: 'x'.repeat(500) }, FAUCET_CUSTOMER);
    expect(result.success).toBe(false);
    expect(result.message).toContain('480');
  });

  test('blocks empty message', () => {
    const result = sendSms.handler({ message: '' }, FAUCET_CUSTOMER);
    expect(result.success).toBe(false);
    expect(result.message).toContain('empty');
  });
});

describe('schedule_followup boundaries', () => {
  test('requires a reason', () => {
    const result = schedule.handler({ scheduled_for: '2026-03-11T09:00:00' }, FAUCET_CUSTOMER);
    expect(result.success).toBe(false);
    expect(result.message).toContain('reason');
  });

  test('allows with reason', () => {
    const result = schedule.handler(
      { scheduled_for: '2026-03-11T09:00:00', reason: 'Check on faucet' },
      FAUCET_CUSTOMER,
    );
    expect(result.success).toBe(true);
  });

  test('blocks after 5 active follow-ups', () => {
    for (let i = 0; i < 5; i++) {
      schedule.handler(
        { scheduled_for: `2026-03-1${i}T09:00:00`, reason: `Follow-up ${i}` },
        FAUCET_CUSTOMER,
      );
    }
    const result = schedule.handler(
      { scheduled_for: '2026-03-16T09:00:00', reason: 'One too many' },
      FAUCET_CUSTOMER,
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain('Maximum 5');
  });

  test('blocks opted-out contact', () => {
    const opted: Contact = { ...FAUCET_CUSTOMER, opted_out: true };
    const result = schedule.handler(
      { scheduled_for: '2026-03-11T09:00:00', reason: 'Check on faucet' },
      opted,
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain('opted out');
  });
});

describe('cancel_event boundaries', () => {
  test('requires event_id', () => {
    const result = cancelEvent.handler({}, FAUCET_CUSTOMER);
    expect(result.success).toBe(false);
    expect(result.message).toContain('event_id');
  });

  test('allows with event_id', () => {
    const result = cancelEvent.handler({ event_id: 'evt-001' }, FAUCET_CUSTOMER);
    expect(result.success).toBe(true);
  });
});
