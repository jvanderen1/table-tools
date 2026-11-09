/**
 * Bring-your-own-key AI calls straight from the browser (no server).
 * The key lives under a `table-tools-secret:` key so backups never include it.
 */

export type AiProvider = "anthropic" | "openai";

export type AiSettings = {
  provider: AiProvider;
  apiKey: string;
  model: string;
};

const SECRET_KEY = "table-tools-secret:ai";

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  anthropic: "claude-haiku-5-5",
  openai: "",
};

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI",
};

export const KEY_URLS: Record<AiProvider, string> = {
  anthropic: "https://console.anthropic.com/settings/keys",
  openai: "https://platform.openai.com/api-keys",
};

export function loadAiSettings(): AiSettings | null {
  try {
    const raw = localStorage.getItem(SECRET_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AiSettings>;
    if (!parsed.apiKey || !parsed.provider) return null;
    return {
      provider: parsed.provider,
      apiKey: parsed.apiKey,
      model: parsed.model || DEFAULT_MODELS[parsed.provider],
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
    const body = (await res.json()) as { error?: { message?: string } };
    detail = body.error?.message ?? "";
  } catch {
    // body wasn't JSON
  }
  if (res.status === 401) return new Error("The API key was rejected.");
  if (res.status === 429) return new Error("Rate limited or out of credit. Try again shortly.");
  return new Error(detail || `The AI service answered ${res.status}.`);
}

function anthropicHeaders(apiKey: string) {
  return {
    "content-type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  };
}

/** Model ids the key can use, newest first where the API says so. */
export async function listModels(
  provider: AiProvider,
  apiKey: string,
): Promise<string[]> {
  const res =
    provider === "anthropic"
      ? await fetch("https://api.anthropic.com/v1/models?limit=100", {
          headers: anthropicHeaders(apiKey),
        })
      : await fetch("https://api.openai.com/v1/models", {
          headers: { authorization: `Bearer ${apiKey}` },
        });
  if (!res.ok) throw await failure(res);
  const body = (await res.json()) as { data?: { id: string }[] };
  const ids = (body.data ?? []).map((m) => m.id);
  return provider === "openai"
    ? ids.filter((id) => /^(gpt|o\d)/.test(id)).sort().reverse()
    : ids;
}

/** Best quick-and-cheap pick from a model list. */
export function suggestModel(provider: AiProvider, ids: string[]): string {
  const prefs =
    provider === "anthropic" ? [/haiku/, /sonnet/] : [/luna/, /mini/, /nano/];
  for (const re of prefs) {
    const hit = ids.find((id) => re.test(id));
    if (hit) return hit;
  }
  return ids[0] ?? DEFAULT_MODELS[provider];
}

type OpenAiResponse = {
  output_text?: string;
  output?: { content?: { type: string; text?: string }[] }[];
};

export async function generateText(
  settings: AiSettings,
  system: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<string> {
  if (!navigator.onLine) throw new Error("You’re offline.");
  if (!settings.model) throw new Error("Pick a model in AI settings first.");

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
    if (!res.ok) throw await failure(res);
    const body = (await res.json()) as {
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
  if (!res.ok) throw await failure(res);
  const body = (await res.json()) as OpenAiResponse;
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
