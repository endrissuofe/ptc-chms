/**
 * Checks the Gemini key works and shows one sample SMS draft. Never prints the key.
 *
 *   PowerShell:  $env:GEMINI_API_KEY = "<key>";  npm run ai:check
 *   (optional)   $env:GEMINI_MODEL = "gemini-3.5-flash-lite"
 */
import 'dotenv/config';

const key = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

async function main() {
  if (!key) {
    console.error('GEMINI_API_KEY is not set.');
    process.exitCode = 1;
    return;
  }
  console.log(`Model: ${model}`);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: 'Write a short friendly church SMS inviting {FirstName} to service tomorrow. Keep {FirstName} as written. End with PTChapel. Under 110 characters, plain characters only. Return JSON {"message": "..."}',
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: { message: { type: 'STRING' } },
            required: ['message'],
          },
        },
      }),
      signal: AbortSignal.timeout(30000),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`Gemini: not working (${res.status}): ${data?.error?.message ?? 'no details'}`);
    process.exitCode = 1;
    return;
  }
  const text = (data?.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text)
    .join('');
  console.log('Gemini: connected. Sample draft:');
  console.log(`  ${JSON.parse(text).message}`);
}

main().catch((err) => {
  console.error(`Gemini: could not connect — ${err.message}`);
  process.exitCode = 1;
});
