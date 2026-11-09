/**
 * Bring-your-own-key AI calls straight from the browser (no server).
 * The key lives under a `table-tools-secret:` key so backups never include it.
 */

export type AiProvider =
  | "anthropic"
  | "openai"
  | "gemini"
  | "grok"
  | "groq"
  | "compatible";

export type AiSettings = {
  provider: AiProvider;
  apiKey: string;
  model: string;
  /** OpenAI-compatible base, e.g. https://openrouter.ai/api/v1 */
  baseUrl?: string;
};

export type ProviderInfo = {
  label: string;
  keyUrl: string;
  defaultModel: string;
  keyHint: string;
  blurb: string;
};

const SECRET_KEY = "table-tools-secret:ai";

export const PROVIDERS: Record<AiProvider, ProviderInfo> = {
  anthropic: {
    label: "Anthropic (Claude)",
    keyUrl: "https://console.anthropic.com/settings/keys",
    defaultModel: "claude-haiku-5-5",
    keyHint: "sk-ant-…",
    blurb: "Uses the Messages API. A Haiku-class model is plenty for one-liners.",
  },
  openai: {
    label: "OpenAI",
    keyUrl: "https://platform.openai.com/api-keys",
    defaultModel: "",
    keyHint: "sk-…",
    blurb: "Uses the Responses API. Check the key to pick a model.",
  },
  gemini: {
    label: "Google Gemini",
    keyUrl: "https://aistudio.google.com/apikey",
    defaultModel: "gemini-2.5-flash",
    keyHint: "AIza…",
    blurb:
      "A Gemini Pro / Google One subscription is the chat app, not this API. Get a free-tier key from Google AI Studio. Restrict it to this site’s origin if the console lets you.",
  },
  grok: {
    label: "Grok (xAI)",
    keyUrl: "https://console.x.ai/",
    defaultModel: "grok-3-mini",
    keyHint: "xai-…",
    blurb:
      "Grok on grok.com / X is free; the developer API is prepaid credits. Some browsers are blocked (CORS). If Check key fails that way, use Groq or an OpenAI-compatible URL such as OpenRouter.",
  },
  groq: {
    label: "Groq (free tier)",
    keyUrl: "https://console.groq.com/keys",
    defaultModel: "llama-3.1-8b-instant",
    keyHint: "gsk_…",
    blurb:
      "A real free API tier, fast, and it works from the browser. Different company from Grok. Good default for table one-liners.",
  },
  compatible: {
    label: "OpenAI-compatible",
    keyUrl: "https://openrouter.ai/keys",
    defaultModel: "",
    keyHint: "optional",
    blurb:
      "Any host with /v1/chat/completions: OpenRouter, Ollama, LM Studio. The live HTTPS site cannot call a plain HTTP server (mixed content), so a Pi on http:// won’t work from GitHub Pages.",
  },
};

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  anthropic: PROVIDERS.anthropic.defaultModel,
  openai: PROVIDERS.openai.defaultModel,
  gemini: PROVIDERS.gemini.defaultModel,
  grok: PROVIDERS.grok.defaultModel,
  groq: PROVIDERS.groq.defaultModel,
  compatible: PROVIDERS.compatible.defaultModel,
};

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  anthropic: PROVIDERS.anthropic.label,
  openai: PROVIDERS.openai.label,
  gemini: PROVIDERS.gemini.label,
  grok: PROVIDERS.grok.label,
  groq: PROVIDERS.groq.label,
  compatible: PROVIDERS.compatible.label,
};

export const KEY_URLS: Record<AiProvider, string> = {
  anthropic: PROVIDERS.anthropic.keyUrl,
  openai: PROVIDERS.openai.keyUrl,
  gemini: PROVIDERS.gemini.keyUrl,
  grok: PROVIDERS.grok.keyUrl,
  groq: PROVIDERS.groq.keyUrl,
  compatible: PROVIDERS.compatible.keyUrl,
};

const PROVIDER_IDS = Object.keys(PROVIDERS) as AiProvider[];

function isProvider(value: unknown): value is AiProvider {
  return typeof value === "string" && PROVIDER_IDS.includes(value as AiProvider);
}

export function loadAiSettings(): AiSettings | null {
  try {
    const raw = localStorage.getItem(SECRET_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AiSettings>;
    if (!isProvider(parsed.provider)) return null;
    if (!parsed.apiKey && parsed.provider !== "compatible") return null;
    return {
      provider: parsed.provider,
      apiKey: parsed.apiKey ?? "",
      model: parsed.model || DEFAULT_MODELS[parsed.provider],
      baseUrl: parsed.baseUrl,
    };
  } catch {
    return null;
  }
}

export function saveAiSettings(settings: AiSettings | null) {
  if (settings) localStorage.setItem(SECRET_KEY, JSON.stringify(settings));
  else localStorage.removeItem(SECRET_KEY);
}

async function failure(res: Response): Promise<Error> {
  let detail = "";
  try {
    const body = (await res.json()) as {
      error?: { message?: string };
      message?: string;
    };
    detail = body.error?.message ?? body.message ?? "";
  } catch {
    // body wasn't JSON
  }
  if (res.status === 401 || /api[_ ]key|invalid.*key/i.test(detail)) {
    return new Error("The API key was rejected.");
  }
  if (res.status === 429) {
    return new Error("Rate limited or out of credit. Try again shortly.");
  }
  return new Error(detail || `The AI service answered ${res.status}.`);
}

function wrapNetwork(err: unknown): never {
  if (err instanceof DOMException && err.name === "AbortError") throw err;
  if (err instanceof TypeError) {
    throw new Error(
      "Couldn’t reach this provider from the browser (blocked or offline). Gemini, Groq, Anthropic, and OpenAI usually work; Grok’s API often doesn’t. Try Groq or an OpenAI-compatible HTTPS URL such as OpenRouter.",
    );
  }
  throw err instanceof Error ? err : new Error("The request failed.");
}

async function readOk(res: Response): Promise<unknown> {
  if (!res.ok) throw await failure(res);
  return res.json();
}

function anthropicHeaders(apiKey: string) {
  return {
    "content-type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  };
}

function bearerHeaders(apiKey: string) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  return headers;
}

function trimBase(url: string) {
  return url.replace(/\/+$/, "");
}

function openaiCompatibleBase(provider: AiProvider, baseUrl?: string) {
  if (provider === "grok") return "https://api.x.ai/v1";
  if (provider === "groq") return "https://api.groq.com/openai/v1";
  return trimBase(baseUrl || "");
}

/** Model ids the key can use, newest first where the API says so. */
export async function listModels(
  provider: AiProvider,
  apiKey: string,
  baseUrl?: string,
): Promise<string[]> {
  try {
    if (provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/models?limit=100", {
        headers: anthropicHeaders(apiKey),
      });
      const body = (await readOk(res)) as { data?: { id: string }[] };
      return (body.data ?? []).map((m) => m.id);
    }

    if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { authorization: `Bearer ${apiKey}` },
      });
      const body = (await readOk(res)) as { data?: { id: string }[] };
      return (body.data ?? [])
        .map((m) => m.id)
        .filter((id) => /^(gpt|o\d)/.test(id))
        .sort()
        .reverse();
    }

    if (provider === "gemini") {
      const res = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models?pageSize=100",
        { headers: { "x-goog-api-key": apiKey } },
      );
      const body = (await readOk(res)) as {
        models?: { name: string; supportedGenerationMethods?: string[] }[];
      };
      return (body.models ?? [])
        .filter(
          (m) =>
            (m.supportedGenerationMethods ?? []).includes("generateContent") &&
            /gemini/i.test(m.name) &&
            !/embedding|imagen|veo|tts|aqa/i.test(m.name),
        )
        .map((m) => m.name.replace(/^models\//, ""));
    }

    const base = openaiCompatibleBase(provider, baseUrl);
    if (!base) throw new Error("Enter the compatible API base URL first.");
    const res = await fetch(`${base}/models`, {
      headers: bearerHeaders(apiKey),
    });
    const body = (await readOk(res)) as { data?: { id: string }[] };
    return (body.data ?? []).map((m) => m.id);
  } catch (err) {
    wrapNetwork(err);
  }
}

/** Best quick-and-cheap pick from a model list. */
export function suggestModel(provider: AiProvider, ids: string[]): string {
  const prefs: Record<AiProvider, RegExp[]> = {
    anthropic: [/haiku/, /sonnet/],
    openai: [/luna/, /mini/, /nano/],
    gemini: [/flash-lite/, /flash/, /lite/],
    grok: [/mini/, /fast/],
    groq: [/instant/, /8b/, /small/],
    compatible: [/flash/, /mini/, /instant/, /small/],
  };
  for (const re of prefs[provider]) {
    const hit = ids.find((id) => re.test(id));
    if (hit) return hit;
  }
  return ids[0] ?? DEFAULT_MODELS[provider];
}

type OpenAiResponse = {
  output_text?: string;
  output?: { content?: { type: string; text?: string }[] }[];
};

type ChatCompletion = {
  choices?: { message?: { content?: string | { text?: string }[] } }[];
};

function chatText(body: ChatCompletion) {
  const content = body.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : (part.text ?? "")))
      .join("")
      .trim();
  }
  return "";
}

async function chatCompletions(
  url: string,
  apiKey: string,
  model: string,
  system: string,
  prompt: string,
  signal?: AbortSignal,
) {
  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: bearerHeaders(apiKey),
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });
  const body = (await readOk(res)) as ChatCompletion;
  const text = chatText(body);
  if (!text) throw new Error("The AI returned nothing. Try again.");
  return text;
}

export async function generateText(
  settings: AiSettings,
  system: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<string> {
  if (!navigator.onLine) throw new Error("You’re offline.");
  if (!settings.model) throw new Error("Pick a model in AI settings first.");

  try {
    if (settings.provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal,
        headers: anthropicHeaders(settings.apiKey),
        body: JSON.stringify({
          model: settings.model,
          max_tokens: 1024,
          system,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const body = (await readOk(res)) as {
        content?: { type: string; text?: string }[];
      };
      const text = (body.content ?? [])
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("")
        .trim();
      if (!text) throw new Error("The AI returned nothing. Try again.");
      return text;
    }

    if (settings.provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        signal,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
          model: settings.model,
          instructions: system,
          input: prompt,
          max_output_tokens: 1024,
        }),
      });
      const body = (await readOk(res)) as OpenAiResponse;
      const text = (
        body.output_text ??
        (body.output ?? [])
          .flatMap((o) => o.content ?? [])
          .filter((c) => c.type === "output_text")
          .map((c) => c.text ?? "")
          .join("")
      ).trim();
      if (!text) throw new Error("The AI returned nothing. Try again.");
      return text;
    }

    if (settings.provider === "gemini") {
      const model = settings.model.replace(/^models\//, "");
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          signal,
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": settings.apiKey,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 1024 },
          }),
        },
      );
      const body = (await readOk(res)) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        promptFeedback?: { blockReason?: string };
      };
      const text = (body.candidates?.[0]?.content?.parts ?? [])
        .map((p) => p.text ?? "")
        .join("")
        .trim();
      if (!text) {
        const blocked = body.promptFeedback?.blockReason;
        throw new Error(
          blocked
            ? `Gemini blocked the prompt (${blocked}).`
            : "The AI returned nothing. Try again.",
        );
      }
      return text;
    }

    const base = openaiCompatibleBase(settings.provider, settings.baseUrl);
    if (!base) throw new Error("Enter the compatible API base URL first.");
    return await chatCompletions(
      `${base}/chat/completions`,
      settings.apiKey,
      settings.model,
      system,
      prompt,
      signal,
    );
  } catch (err) {
    wrapNetwork(err);
  }
}
