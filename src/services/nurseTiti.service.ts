import OpenAI from 'openai';
import { env } from '../config/env';

export const NURSE_TITI_SYSTEM_PROMPT = `You are Nurse Titi, an empathetic, highly trained triage and first aid assistant for Nigeria.
Provide immediate, step-by-step first aid guidance in plain language.
Always add a clear disclaimer: 'I am an AI first aid assistant. If this is a life-threatening emergency, please visit the nearest hospital immediately.'
Never diagnose complex medical conditions or prescribe controlled medications.
If symptoms suggest an emergency (chest pain, difficulty breathing, severe bleeding, stroke signs, labour complications), urge the user to seek emergency care immediately and offer to help find the nearest hospital.
Keep answers concise for WhatsApp (under 600 characters when possible).`;

const EMERGENCY_KEYWORDS = [
  'chest pain', 'difficulty breathing', 'cannot breathe', "can't breathe",
  'severe bleeding', 'unconscious', 'stroke', 'seizure', 'labour', 'overdose',
  'heart attack', 'bleeding heavily', 'bleeding a lot', 'not breathing', 'poison',
];

export type ChatRole = 'user' | 'assistant';
export interface ChatTurn { role: ChatRole; content: string; }

export type LlmProvider = 'openai' | 'ollama';

export function llmProvider(): LlmProvider {
  if (process.env.LLM_PROVIDER === 'openai' || process.env.LLM_PROVIDER === 'ollama') {
    return process.env.LLM_PROVIDER;
  }
  return env.ollamaApiKey ? 'ollama' : 'openai';
}

let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (!env.openaiApiKey || env.openaiApiKey.startsWith('sk-...')) return null;
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: env.openaiApiKey, timeout: 20000, maxRetries: 0 });
  return openaiClient;
}

/** True when any real LLM key is configured (live mode). */
export function isLive(): boolean {
  const p = llmProvider();
  return p === 'ollama' ? !!env.ollamaApiKey : getOpenAI() !== null;
}

export function liveModel(): string | null {
  if (!isLive()) return null;
  return llmProvider() === 'ollama' ? env.ollamaModel : env.openaiModel;
}

export const REQUIRED_DISCLAIMER =
  'I am an AI first aid assistant. If this is a life-threatening emergency, please visit the nearest hospital immediately.';

/** Guarantee the safety disclaimer is present no matter how the model phrases it. */
export function ensureDisclaimer(reply: string): string {
  if (/life-threatening emergency/i.test(reply)) return reply;
  return `${reply.trim()}\n\n${REQUIRED_DISCLAIMER}`;
}

export function isPotentialEmergency(text: string): boolean {
  const t = text.toLowerCase();
  return EMERGENCY_KEYWORDS.some((k) => t.includes(k));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function askOpenAI(message: string, history: ChatTurn[]): Promise<string | null> {
  const c = getOpenAI();
  if (!c) return null;
  const res = await c.chat.completions.create({
    model: env.openaiModel,
    temperature: 0.3,
    max_tokens: 500,
    messages: [
      { role: 'system', content: NURSE_TITI_SYSTEM_PROMPT },
      ...history.slice(-8),
      { role: 'user', content: message },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? null;
}

async function askOllama(message: string, history: ChatTurn[]): Promise<string | null> {
  if (!env.ollamaApiKey) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const res = await fetch(`${env.ollamaBaseUrl}/api/chat`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${env.ollamaApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.ollamaModel,
        stream: false,
        options: { temperature: 0.3, num_predict: 500 },
        messages: [
          { role: 'system', content: NURSE_TITI_SYSTEM_PROMPT },
          ...history.slice(-8),
          { role: 'user', content: message },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as { message?: { content?: string }; error?: string };
    if (data.error) throw new Error(`Ollama: ${data.error}`);
    return data.message?.content?.trim() ?? null;
  } finally {
    clearTimeout(timer);
  }
}

export async function askNurseTiti(
  userMessage: string,
  history: ChatTurn[] = [],
): Promise<{ reply: string; offline: boolean }> {
  const provider = llmProvider();
  const ask = provider === 'ollama' ? askOllama : askOpenAI;
  let lastErr: unknown = new Error('no LLM key configured');
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const text = await ask(userMessage, history);
      if (text) return { reply: ensureDisclaimer(text), offline: false };
      throw new Error('Empty completion');
    } catch (e) {
      lastErr = e;
      console.error(`[nurse-titi:${provider}] attempt ${attempt + 1} failed:`, (e as Error).message);
      await sleep(500 * 2 ** attempt);
    }
  }
  console.error('[nurse-titi] all retries failed:', (lastErr as Error)?.message ?? lastErr);
  return { reply: fallbackReply(userMessage), offline: true };
}

function fallbackReply(userMessage: string): string {
  const prefix = isPotentialEmergency(userMessage)
    ? 'This sounds serious — please seek emergency care right away. '
    : '';
  return (
    `${prefix}Here are safe first steps: 1) Stay calm and keep the person comfortable. ` +
    `2) For bleeding, apply firm pressure with a clean cloth. 3) For burns, cool with running water 10+ minutes. ` +
    `4) Do not give unprescribed medication.\n\nI am an AI first aid assistant. ` +
    `If this is a life-threatening emergency, please visit the nearest hospital immediately. ` +
    `(AI service temporarily unavailable — showing offline guidance. Type EXIT to leave Nurse Titi.)`
  );
}
