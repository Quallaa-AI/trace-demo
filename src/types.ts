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

export type TraceEntry = {
  scenario: string;
  timestamp: string;
  model_saw: string;        // the temporal context block
  model_decided: string;    // the agent's response text
  tools_called: ToolCall[];
  duration_ms: number;
};

export type EvalResult = {
  scenario: string;
  variant: string;
  response: string;
  checks: { name: string; passed: boolean; detail: string }[];
  score: number;
};

export type DifferentiationResult = {
  scenario: string;
  variant_a: EvalResult;
  variant_b: EvalResult;
  differentiation_score: number; // 0 = identical behavior, 1 = fully differentiated
  explanation: string;
};
