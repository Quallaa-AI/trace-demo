// Core types for the TRACE framework demo.
// Every other file imports from here.

export type Message = {
  role: 'customer' | 'agent';
  content: string;
  timestamp: string; // ISO 8601
};

export type Contact = {
  name: string;
  phone: string;
  timezone: string;
  opted_out: boolean;
};

export type ToolCall = {
  tool: string;
  input: Record<string, unknown>;
  result: string;
};

export type DifferentiationResult = {
  scenario: string;
  differentiation_score: number; // 0 = identical behavior, 1 = fully differentiated
  explanation: string;
  response_a: string;
  response_b: string;
};
