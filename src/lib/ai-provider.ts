export class AiError extends Error {}

/**
 * Shared across every AI-written surface (news/financials summary cards, the daily email
 * summary) so they all speak in one voice — a reader shouldn't be able to tell which
 * feature produced a given paragraph.
 */
export const TONE_INSTRUCTION =
  "โทนเป็นทางการแบบนักวิเคราะห์การลงทุนมืออาชีพ น้ำเสียงเป็นกลาง ไม่แสดงอารมณ์หรือความเห็นส่วนตัว หลีกเลี่ยงคำที่สื่อถึงความตื่นเต้น กังวล หรือดราม่าเกินจริง ใช้ภาษาสุภาพเป็นทางการ เน้นข้อเท็จจริงและตัวเลขอย่างตรงไปตรงมา ลงท้ายประโยคด้วย 'ครับ' ตามความเหมาะสมของหลักไวยากรณ์";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Attempt {
  name: string;
  call: (messages: ChatMessage[], system?: string) => Promise<string>;
}

async function callGemini(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  system?: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      generationConfig: {
        // A short casual-tone summary doesn't need extended reasoning — keeps it fast and cheap.
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: 1600,
        temperature: 0.6,
      },
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new AiError(`GEMINI_HTTP_${res.status}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new AiError("GEMINI_NO_CONTENT");
  return text.trim();
}

/** Groq and OpenRouter both speak the OpenAI chat-completions format. */
async function callOpenAiCompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  system?: string
): Promise<string> {
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: system ? [{ role: "system", content: system }, ...messages] : messages,
      temperature: 0.6,
      max_tokens: 1600,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new AiError(`HTTP_${res.status}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new AiError("NO_CONTENT");
  return text.trim();
}

function buildProviderChain(): Attempt[] {
  const attempts: Attempt[] = [];

  const geminiModel = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";
  const geminiKeys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_BACKUP,
    process.env.GEMINI_API_KEY_SECONDARY,
  ].filter((k): k is string => Boolean(k));
  geminiKeys.forEach((key, i) =>
    attempts.push({
      name: `gemini${i > 0 ? `-${i + 1}` : ""}`,
      call: (messages, system) => callGemini(key, geminiModel, messages, system),
    })
  );

  // Not "openai/gpt-oss-20b" — that's a reasoning model that burns most of its token
  // budget on hidden chain-of-thought before answering, which caused real truncated/cut-off
  // summaries (see git history). Llama 3.3 70B is a plain instruct model, no reasoning
  // tokens, more predictable output length.
  const groqModel = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
  const groqKeys = [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_BACKUP].filter(
    (k): k is string => Boolean(k)
  );
  groqKeys.forEach((key, i) =>
    attempts.push({
      name: `groq${i > 0 ? `-${i + 1}` : ""}`,
      call: (messages, system) =>
        callOpenAiCompatible("https://api.groq.com/openai/v1/chat/completions", key, groqModel, messages, system),
    })
  );

  const openRouterModel = process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free";
  const openRouterKeys = [
    process.env.OPENROUTER_API_KEY,
    process.env.OPENROUTER_API_KEY_BACKUP,
  ].filter((k): k is string => Boolean(k));
  openRouterKeys.forEach((key, i) =>
    attempts.push({
      name: `openrouter${i > 0 ? `-${i + 1}` : ""}`,
      call: (messages, system) =>
        callOpenAiCompatible(
          "https://openrouter.ai/api/v1/chat/completions",
          key,
          openRouterModel,
          messages,
          system
        ),
    })
  );

  return attempts;
}

/**
 * Tries every configured AI provider/key in order (Gemini keys, then Groq keys, then
 * OpenRouter keys) and returns the first successful response — spreads usage across
 * free-tier quotas so one provider running out doesn't take the feature down.
 */
export async function generateChatReply(messages: ChatMessage[], system?: string): Promise<string> {
  const chain = buildProviderChain();
  if (chain.length === 0) throw new AiError("MISSING_AI_API_KEY");

  let lastError: unknown = new AiError("ALL_PROVIDERS_FAILED");
  for (const attempt of chain) {
    try {
      return await attempt.call(messages, system);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

export async function generateSummary(prompt: string): Promise<string> {
  return generateChatReply([{ role: "user", content: prompt }]);
}
