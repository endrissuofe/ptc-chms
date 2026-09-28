import { logger } from '../logger';

/**
 * The AI writer, server side only. AI_PROVIDER picks it:
 *   gemini  Google Gemini (GEMINI_API_KEY; GEMINI_MODEL, default gemini-3.5-flash-lite)
 *   mock    canned answers (tests)
 *   off     no AI: messages use their backup wordings
 * With no AI_PROVIDER set, Gemini is used when GEMINI_API_KEY is set, otherwise it's off.
 * Never send people's names or numbers: prompts carry only {FirstName}-style tags.
 */
export function aiStatus() {
  const provider = process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : 'off');
  return {
    provider,
    on: provider !== 'off',
    model: provider === 'gemini' ? process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite' : null,
  };
}

/**
 * Asks the AI for one JSON object. `schema` is an OpenAPI-style object schema.
 * Returns the parsed object, or throws with a short reason.
 */
export async function askJson({ system, prompt, schema, temperature = 1 }) {
  const { provider, model } = aiStatus();
  if (provider === 'off') throw new Error('AI is switched off');
  if (provider === 'mock') return mockAnswer(prompt);
  if (provider !== 'gemini') throw new Error(`Unknown AI_PROVIDER "${provider}"`);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      }),
      signal: AbortSignal.timeout(30000),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = data?.error?.message || `HTTP ${res.status}`;
    logger.warn({ status: res.status, reason }, 'Gemini request failed');
    throw new Error(`Gemini: ${reason}`);
  }
  const text = (data?.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('');
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Gemini: the answer wasn’t valid JSON');
  }
}

/** Tests: a fixed, valid answer built from the tags the prompt asks for. */
function mockAnswer(prompt) {
  const tags = [...new Set(prompt.match(/\{[A-Za-z]+\}/g) ?? [])].filter(
    (t) => t !== '{FirstName}',
  );
  return {
    message:
      `Hi {FirstName}, from all of us at church: God bless you this week! ${tags.join(' ')} - PTChapel`
        .replace(/\s+/g, ' ')
        .trim(),
  };
}
