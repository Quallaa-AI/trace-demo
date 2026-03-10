// Adaptive eval — paired differentiation scoring with LLM-as-judge.
//
// Same scenario, two temporal contexts, score 0–1 on whether
// behavior actually changes. This is the eval that tells you
// whether your context engineering is working.
//
// Standard regex evals can tell you a response is acceptable.
// Paired differentiation tells you the model is responding to context.

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { DifferentiationResult } from './types';

const client = new Anthropic();

// --- Paired differentiation scoring (LLM-as-judge) ---
// Same scenario run with two different temporal contexts.
// An LLM judge evaluates whether behavior changed meaningfully
// across three dimensions: urgency, action, and tone.

export async function scoreDifferentiation(
  scenario: string,
  responseA: string,
  variantA: string,
  responseB: string,
  variantB: string,
  context: string,
): Promise<DifferentiationResult> {
  const judgePrompt = `You are an eval judge scoring whether two AI agent responses show meaningfully different BEHAVIOR — not just different wording.

${context}

Response A (${variantA}):
"${responseA}"

Response B (${variantB}):
"${responseB}"

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
    scenario,
    differentiation_score: Math.round(score * 100) / 100,
    explanation: details.join('\n'),
    response_a: responseA,
    response_b: responseB,
  };
}

// --- Formatting ---

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';

export function formatDifferentiation(result: DifferentiationResult): string {
  const lines: string[] = [];
  const score = result.differentiation_score;
  const color = score >= 0.7 ? GREEN : score >= 0.4 ? YELLOW : '\x1b[31m';

  lines.push(`${BOLD}${CYAN}━━━ PAIRED EVAL: ${result.scenario} ━━━${RESET}`);
  lines.push(`${BOLD}Differentiation score: ${color}${score.toFixed(2)}${RESET}`);
  lines.push('');
  lines.push(`${BOLD}Response A:${RESET}`);
  lines.push(`  ${DIM}${result.response_a.substring(0, 120)}${result.response_a.length > 120 ? '...' : ''}${RESET}`);
  lines.push(`${BOLD}Response B:${RESET}`);
  lines.push(`  ${DIM}${result.response_b.substring(0, 120)}${result.response_b.length > 120 ? '...' : ''}${RESET}`);
  lines.push('');
  lines.push(result.explanation);
  lines.push(`${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);

  return lines.join('\n');
}
