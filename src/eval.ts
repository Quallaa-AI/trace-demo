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

import { EvalResult, DifferentiationResult } from './types';

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

// --- Paired differentiation scoring ---
// Same scenario run with two different temporal contexts.
// The judge looks at whether the model's behavior changed meaningfully.

export function scoreDifferentiation(
  resultA: EvalResult,
  resultB: EvalResult,
  differentiators: { name: string; test: (a: string, b: string) => boolean; weight: number }[],
): DifferentiationResult {
  let totalWeight = 0;
  let weightedScore = 0;
  const details: string[] = [];

  for (const d of differentiators) {
    const different = d.test(resultA.response, resultB.response);
    totalWeight += d.weight;
    if (different) {
      weightedScore += d.weight;
      details.push(`✓ ${d.name}: behavior differs`);
    } else {
      details.push(`✗ ${d.name}: no difference detected`);
    }
  }

  const score = totalWeight > 0 ? weightedScore / totalWeight : 0;

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
