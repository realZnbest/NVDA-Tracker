const DEFAULT_MODEL = "gemini-3.5-flash";

export class GeminiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

export async function generateSummary(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiError("MISSING_GEMINI_API_KEY");

  const model = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        // A short casual-tone summary doesn't need extended reasoning — keeps it fast and cheap.
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: 400,
        temperature: 0.6,
      },
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new GeminiError(`GEMINI_HTTP_${res.status}`, res.status);
  }

  const data = (await res.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new GeminiError("GEMINI_NO_CONTENT");
  return text.trim();
}
