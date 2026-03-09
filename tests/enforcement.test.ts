import {
  isOptedOut, isRaceCondition, exceedsDuplicationCap,
  runEnforcementGates, ScheduledEvent,
} from '../src/enforcement';
import { FAUCET_CUSTOMER } from '../src/conversation';
import { Contact } from '../src/types';

describe('opt-out enforcement', () => {
  test('allows active contact', () => {
    expect(isOptedOut(FAUCET_CUSTOMER).blocked).toBe(false);
  });

  test('blocks opted-out contact', () => {
    const opted: Contact = { ...FAUCET_CUSTOMER, opted_out: true };
    expect(isOptedOut(opted).blocked).toBe(true);
  });
});

describe('race guard', () => {
  const event: ScheduledEvent = {
    id: 'evt-001',
    contact_phone: '+15551234567',
    scheduled_for: '2026-03-12T09:00:00Z',
    status: 'pending',
  };

  test('allows first fire', () => {
    expect(isRaceCondition(event, []).blocked).toBe(false);
  });

  test('blocks duplicate within 5 minutes', () => {
    const recent: ScheduledEvent = {
      id: 'evt-000',
      contact_phone: '+15551234567',
      scheduled_for: '2026-03-12T09:02:00Z',
      status: 'fired',
    };
    expect(isRaceCondition(event, [recent]).blocked).toBe(true);
  });

  test('allows if different contact', () => {
    const recent: ScheduledEvent = {
      id: 'evt-000',
      contact_phone: '+15559999999',
      scheduled_for: '2026-03-12T09:01:00Z',
      status: 'fired',
    };
    expect(isRaceCondition(event, [recent]).blocked).toBe(false);
  });

  test('allows if outside 5-minute window', () => {
    const recent: ScheduledEvent = {
      id: 'evt-000',
      contact_phone: '+15551234567',
      scheduled_for: '2026-03-12T08:00:00Z',
      status: 'fired',
    };
    expect(isRaceCondition(event, [recent]).blocked).toBe(false);
  });
});

describe('duplication cap', () => {
  const makeEvents = (n: number): ScheduledEvent[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `evt-${i}`,
      contact_phone: '+15551234567',
      scheduled_for: `2026-03-1${3 + i}T09:00:00Z`,
      status: 'pending' as const,
    }));

  test('allows under cap', () => {
    expect(exceedsDuplicationCap('+15551234567', makeEvents(3)).blocked).toBe(false);
  });

  test('blocks at cap', () => {
    expect(exceedsDuplicationCap('+15551234567', makeEvents(5)).blocked).toBe(true);
  });

  test('ignores cancelled events', () => {
    const events = makeEvents(5).map(e => ({ ...e, status: 'cancelled' as const }));
    expect(exceedsDuplicationCap('+15551234567', events).blocked).toBe(false);
  });
});

describe('full enforcement stack', () => {
  const event: ScheduledEvent = {
    id: 'evt-001',
    contact_phone: '+15551234567',
    scheduled_for: '2026-03-12T09:00:00Z',
    status: 'pending',
  };

  test('allows when all gates pass', () => {
    const result = runEnforcementGates(FAUCET_CUSTOMER, event, [], []);
    expect(result.allowed).toBe(true);
    expect(result.blocked_by).toHaveLength(0);
  });

  test('blocks with multiple violations', () => {
    const opted: Contact = { ...FAUCET_CUSTOMER, opted_out: true };
    const fiveActive = Array.from({ length: 5 }, (_, i) => ({
      id: `evt-${i}`,
      contact_phone: '+15551234567',
      scheduled_for: `2026-03-1${3 + i}T09:00:00Z`,
      status: 'pending' as const,
    }));
    const recentFire = [{
      id: 'evt-000',
      contact_phone: '+15551234567',
      scheduled_for: '2026-03-12T09:01:00Z',
      status: 'fired' as const,
    }];

    const result = runEnforcementGates(opted, event, fiveActive, recentFire);
    expect(result.allowed).toBe(false);
    expect(result.blocked_by.length).toBeGreaterThanOrEqual(2);
  });
});
