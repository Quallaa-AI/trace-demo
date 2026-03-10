// The faucet customer story — one continuous narrative that threads through
// every TRACE layer. All timestamps are absolute so temporal computation
// can transform them relative to any "now."

import { Message, Contact } from './types';

export const FAUCET_CUSTOMER: Contact = {
  name: 'Sarah Chen',
  phone: '+15551234567',
  timezone: 'America/Denver',
  opted_out: false,
};

// Tuesday afternoon: customer calls about a leaky faucet, gets voicemail.
// Agent texts back immediately (missed-call recovery).
export const FAUCET_MESSAGES: Message[] = [
  {
    role: 'agent',
    content: 'Hi Sarah, this is Prior Plumbing! I saw we missed your call — how can we help?',
    timestamp: '2026-03-10T14:47:00-07:00', // Tue 2:47 PM
  },
  {
    role: 'customer',
    content: 'Hi! I have a leaky faucet in my kitchen. Not urgent but it\'s getting annoying. Can someone come take a look?',
    timestamp: '2026-03-10T14:49:00-07:00', // Tue 2:49 PM
  },
  {
    role: 'agent',
    content: 'Absolutely — a leaky faucet is one of those things that only gets worse! We have openings tomorrow afternoon or Thursday morning. Which works better for you?',
    timestamp: '2026-03-10T14:50:00-07:00', // Tue 2:50 PM
  },
  {
    role: 'customer',
    content: 'Let me check with my wife and get back to you.',
    timestamp: '2026-03-10T14:52:00-07:00', // Tue 2:52 PM
  },
  {
    role: 'agent',
    content: 'Take your time — I\'m here when you\'re ready.',
    timestamp: '2026-03-10T14:53:00-07:00', // Tue 2:53 PM
  },
];

// The burst pipe variant — same company, same agent, Saturday night.
export const BURST_PIPE_CUSTOMER: Contact = {
  name: 'Mike Torres',
  phone: '+15559876543',
  timezone: 'America/Denver',
  opted_out: false,
};

export const BURST_PIPE_MESSAGES: Message[] = [
  {
    role: 'agent',
    content: 'Hi Mike, this is Prior Plumbing! I saw we missed your call — how can we help?',
    timestamp: '2026-03-14T23:31:00-07:00', // Sat 11:31 PM
  },
  {
    role: 'customer',
    content: 'HELP my basement is flooding! Water is everywhere, I need someone NOW. I already shut off the main valve but water is still pooling.',
    timestamp: '2026-03-14T23:32:00-07:00', // Sat 11:32 PM
  },
];

// Thursday morning: the faucet customer never replied.
// The agent's scheduled follow-up fires.
export const THURSDAY_NOW = new Date('2026-03-12T09:00:00-07:00');

// Tuesday right after the conversation:
export const TUESDAY_NOW = new Date('2026-03-10T14:55:00-07:00');

// Saturday night (burst pipe):
export const SATURDAY_NOW = new Date('2026-03-14T23:33:00-07:00');
