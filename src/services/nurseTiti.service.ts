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
  'heart attack', 'bleeding heavily', 'not breathing', 'poison',
];

export type ChatRole = 'user' | 'assistant';
export interface ChatTurn { role: ChatRole; content: string; }

let client: OpenAI | null = null;
function getClient(): OpenAI | null {
  if (!env.openaiApiKey || env.openaiApiKey.startsWith('sk-...')) return null;
  if (!client) client = new OpenAI({ apiKey: env.openaiApiKey, timeout: 20000, maxRetries: 0 });
  return client;
}

/** True when a real OpenAI key is configured (live mode). */
export function isLive(): boolean {
  return getClient() !== null;
}

export function isPotentialEmergency(text: string): boolean {
  const t = text.toLowerCase();
  return EMERGENCY_KEYWORDS.some((k) => t.includes(k));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function askNurseTiti(
  userMessage: string,
  history: ChatTurn[] = [],
): Promise<{ reply: string; offline: boolean }> {
  const c = getClient();
  if (!c) return { reply: fallbackReply(userMessage), offline: true };

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await c.chat.completions.create({
        model: env.openaiModel,
        temperature: 0.3,
        max_tokens: 500,
        messages: [
          { role: 'system', content: NURSE_TITI_SYSTEM_PROMPT },
          ...history.slice(-8),
          { role: 'user', content: userMessage },
        ],
      });
      const text = res.choices[0]?.message?.content?.trim();
      if (text) return { reply: text, offline: false };
      throw new Error('Empty completion');
    } catch (e) {
      lastErr = e;
      console.error(`[nurse-titi] attempt ${attempt + 1} failed:`, (e as Error).message);
      await sleep(500 * 2 ** attempt);
    }
  }
  console.error('[nurse-titi] all retries failed:', lastErr);
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
