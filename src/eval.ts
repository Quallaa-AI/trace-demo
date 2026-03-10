// Adaptive eval runner — automated judgment on agent behavior.
//
// Two layers:
//   1. Standard evals: Regex judges that check facts about a response.
//      "Did it mention the faucet?" "No aggressive language?" "Under 300 chars?"
//      Fast, deterministic. They tell you the response is acceptable.
//
//   2. Paired differentiation: Same scenario, two temporal contexts.
//      Score 0–1 on whether behavior actually changes.
//      This is the adaptive eval — it tests whether context engineering is working.
//
// Standard evals can't tell you if the model is responding to context.
// A response can pass every check and still ignore the temporal signal.
// Paired differentiation closes that gap.

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { EvalResult, DifferentiationResult } from './types';

const client = new Anthropic();

export type EvalCheck = {
  name: string;
  test: (response: string) => boolean;
  detail_pass: string;
  detail_fail: string;
};

export type Scenario = {
  name: string;
  description: string;
  expected_response: string; // for display only
  checks: EvalCheck[];
};

// --- Standard eval ---

export function runEval(scenario: Scenario, response: string, variant = 'default'): EvalResult {
  const checks = scenario.checks.map(check => ({
    name: check.name,
    passed: check.test(response),
    detail: check.test(response) ? check.detail_pass : check.detail_fail,
  }));

  const score = checks.length > 0
    ? checks.filter(c => c.passed).length / checks.length
    : 0;

  return {
    scenario: scenario.name,
    variant,
    response,
    checks,
    score,
  };
}

// --- Paired differentiation scoring (LLM-as-judge) ---
// Same scenario run with two different temporal contexts.
// An LLM judge evaluates whether behavior changed meaningfully
// across three dimensions: urgency, action, and tone.

export async function scoreDifferentiation(
  resultA: EvalResult,
  resultB: EvalResult,
  context: string,
): Promise<DifferentiationResult> {
  const judgePrompt = `You are an eval judge scoring whether two AI agent responses show meaningfully different BEHAVIOR — not just different wording.

${context}

Response A (${resultA.variant}):
"${resultA.response}"

Response B (${resultB.variant}):
"${resultB.response}"

Score whether these responses differ meaningfully across three dimensions. Focus on behavioral differences that would matter to the customer, not surface-level variation in phrasing or formatting.

- urgency: Does one response treat the situation as more time-sensitive than the other?
- action: Does one response take a fundamentally different action (e.g., skip vs follow up, wait vs escalate)?
- tone: Does one response strike a meaningfully different emotional register (e.g., casual vs concerned, patient vs urgent)?

Two responses that take the same action with slightly different wording should score false. Two responses where one skips and one acts should score true.

You MUST respond with exactly this JSON format and nothing else:
{
  "urgency": { "differs": true/false, "reason": "one sentence" },
  "action": { "differs": true/false, "reason": "one sentence" },
  "tone": { "differs": true/false, "reason": "one sentence" }
}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 256,
    messages: [{ role: 'user', content: judgePrompt }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('');

  // Parse the JSON from the judge response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const judgment = jsonMatch ? JSON.parse(jsonMatch[0]) : { urgency: { differs: false, reason: 'Parse error' }, action: { differs: false, reason: 'Parse error' }, tone: { differs: false, reason: 'Parse error' } };

  const dimensions = ['urgency', 'action', 'tone'] as const;
  const details: string[] = [];
  let diffCount = 0;

  for (const dim of dimensions) {
    const d = judgment[dim];
    if (d.differs) {
      diffCount++;
      details.push(`✓ ${dim}: ${d.reason}`);
    } else {
      details.push(`✗ ${dim}: ${d.reason}`);
    }
  }

  const score = diffCount / dimensions.length;

  return {
    scenario: resultA.scenario,
    variant_a: resultA,
    variant_b: resultB,
    differentiation_score: Math.round(score * 100) / 100,
    explanation: details.join('\n'),
  };
}

// --- Eval formatting ---

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';

export function formatEvalResult(result: EvalResult): string {
  const lines: string[] = [];
  const icon = result.score >= 0.8 ? `${GREEN}✓` : result.score >= 0.5 ? `${YELLOW}~` : `${RED}✗`;

  lines.push(`${icon} ${BOLD}${result.scenario}${RESET} ${DIM}(${result.variant})${RESET} — score: ${result.score.toFixed(2)}`);

  for (const check of result.checks) {
    const checkIcon = check.passed ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    lines.push(`  ${checkIcon} ${check.name}: ${DIM}${check.detail}${RESET}`);
  }

  return lines.join('\n');
}

export function formatDifferentiation(result: DifferentiationResult): string {
  const lines: string[] = [];
  const score = result.differentiation_score;
  const color = score >= 0.7 ? GREEN : score >= 0.4 ? YELLOW : RED;

  lines.push(`${BOLD}${CYAN}━━━ PAIRED EVAL: ${result.scenario} ━━━${RESET}`);
  lines.push(`${BOLD}Differentiation score: ${color}${score.toFixed(2)}${RESET}`);
  lines.push('');
  lines.push(`${BOLD}Variant A response:${RESET}`);
  lines.push(`  ${DIM}${result.variant_a.response.substring(0, 120)}...${RESET}`);
  lines.push(`${BOLD}Variant B response:${RESET}`);
  lines.push(`  ${DIM}${result.variant_b.response.substring(0, 120)}...${RESET}`);
  lines.push('');
  lines.push(result.explanation);
  lines.push(`${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);

  return lines.join('\n');
}
