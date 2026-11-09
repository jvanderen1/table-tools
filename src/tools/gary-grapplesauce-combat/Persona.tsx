import { useRef, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  HandHeart,
  HeartCrack,
  KeyRound,
  LoaderCircle,
  Megaphone,
  MessageCircle,
  MessageSquareQuote,
  RefreshCw,
  ScrollText,
  Settings,
  Swords,
  Trash2,
  Trophy,
  TriangleAlert,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import {
  DEFAULT_MODELS,
  PROVIDER_ORDER,
  PROVIDERS,
  generateText,
  listModels,
  loadAiSettings,
  saveAiSettings,
  suggestModel,
  type AiProvider,
  type AiSettings,
} from "../../lib/ai";
import { cx } from "../../lib/cx";
import { usePersistentState } from "../../lib/usePersistentState";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Drawer,
  Stack,
  Text,
} from "../../ui";

type Bio = {
  concept: string;
  personality: string;
  voice: string;
  ideals: string;
  bonds: string;
  flaws: string;
  backstory: string;
};

const DEFAULT_BIO: Bio = {
  concept:
    "Human farmer turned Pugilist (Squared Circle), level 9. Bald gym-bro with a soft-looking build and an empty, kind stare.",
  personality:
    "Earnest, gentle, and a little simple. Treats every fight like a workout and every ally like a gym buddy. Soft comedy, never mean. When unsure: punch, then offer a spot.",
  voice:
    "Short gym lines: “Cardio.” “HEY.” “Sit Down.” “Still Hugging.” “Leg Day.” “One more rep.” “Spot me.” Calls grapples hugs and fights sets.",
  ideals: "",
  bonds: "",
  flaws: "",
  backstory:
    "A farmer whose strength comes from the Lifting Belt (Strength 8 without it). Now adventuring in Tomb of Annihilation.",
};

const BIO_FIELDS: {
  id: keyof Bio;
  label: string;
  rows: number;
  placeholder: string;
}[] = [
  { id: "concept", label: "Concept & look", rows: 2, placeholder: "One-line pitch and appearance" },
  { id: "personality", label: "Personality", rows: 3, placeholder: "How he acts" },
  { id: "voice", label: "Voice & catchphrases", rows: 3, placeholder: "How he talks, signature lines" },
  { id: "ideals", label: "Ideals", rows: 2, placeholder: "What he believes in" },
  { id: "bonds", label: "Bonds", rows: 2, placeholder: "People and places he’d fight for" },
  { id: "flaws", label: "Flaws", rows: 2, placeholder: "What gets him in trouble" },
  { id: "backstory", label: "Backstory", rows: 6, placeholder: "Where he came from" },
];

type Ask = { id: string; label: string; icon: LucideIcon; ask: string };

const ASKS: Ask[] = [
  { id: "battle-cry", label: "Battle cry", icon: Megaphone, ask: "A battle cry as he charges in." },
  { id: "taunt", label: "Taunt", icon: Swords, ask: "A taunt aimed at the enemy in front of him." },
  { id: "hype", label: "Hype ally", icon: HandHeart, ask: "Encouragement for an ally who’s struggling." },
  { id: "reply", label: "Reply", icon: MessageCircle, ask: "His reply to what was just said or done to him." },
  { id: "hurt", label: "Took a hit", icon: HeartCrack, ask: "What he says right after taking a big hit." },
  { id: "win", label: "Victory", icon: Trophy, ask: "A line after the fight is won." },
];

const FREEFORM = "A short line that fits the situation.";

type VoiceLine = { id: string; label: string; text: string };

const VOICE_LOG_MAX = 20;

const FIELD =
  "w-full appearance-none rounded-lg border border-line bg-well px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-gold/70";
const LABEL =
  "text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-faint";

function lineId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function systemPrompt(bio: Bio, status: string) {
  const sheet = BIO_FIELDS.filter((f) => bio[f.id].trim())
    .map((f) => `${f.label}: ${bio[f.id].trim()}`)
    .join("\n");
  return [
    "You voice Gary Grapplesauce, a D&D player character, for his player at the table.",
    "Reply with only what Gary says out loud, optionally opening with one short action in *asterisks*.",
    "One or two short sentences, in his voice. PG-13 and never mean-spirited.",
    "Don’t explain rules, numbers, or dice, and don’t wrap the line in quotes.",
    "",
    sheet,
    "",
    `Right now: ${status}`,
  ].join("\n");
}

export function PersonaPanel({ status }: { status: string }) {
  const [bio, setBio] = usePersistentState<Bio>(
    "gary-grapplesauce-combat:bio",
    DEFAULT_BIO,
  );
  return (
    <Stack gap={14}>
      <VoiceCard bio={{ ...DEFAULT_BIO, ...bio }} status={status} />
      <Card>
        <CardHeader icon={UserRound}>Personality & biography</CardHeader>
        <CardBody>
          <Stack gap={12}>
            <Text tone="tertiary">
              Saved on this device and in backups. The line generator reads
              all of it.
            </Text>
            {BIO_FIELDS.map((f) => (
              <label key={f.id} className="flex flex-col gap-1">
                <span className={LABEL}>{f.label}</span>
                <textarea
                  className={cx(FIELD, "resize-y leading-snug")}
                  rows={f.rows}
                  placeholder={f.placeholder}
                  value={bio[f.id] ?? ""}
                  onChange={(e) =>
                    setBio((b) => ({ ...DEFAULT_BIO, ...b, [f.id]: e.target.value }))
                  }
                />
              </label>
            ))}
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  );
}

function VoiceCard({ bio, status }: { bio: Bio; status: string }) {
  const [settings, setSettings] = useState<AiSettings | null>(loadAiSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [situation, setSituation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAsk, setLastAsk] = useState<Ask | null>(null);
  const [copied, setCopied] = useState(false);
  const [log, setLog] = usePersistentState<VoiceLine[]>(
    "gary-grapplesauce-combat:voice-log",
    [],
  );
  const abortRef = useRef<AbortController | null>(null);
  const latest = log[0];

  async function generate(ask: Ask | null) {
    if (!settings || busy) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    setLastAsk(ask);
    setCopied(false);
    const prompt = [
      `Situation: ${situation.trim() || "(not described; keep it general)"}`,
      `What I need: ${ask?.ask ?? FREEFORM}`,
    ].join("\n");
    try {
      const text = await generateText(
        settings,
        systemPrompt(bio, status),
        prompt,
        controller.signal,
      );
      setLog((prev) =>
        [{ id: lineId(), label: ask?.label ?? "Line", text }, ...prev].slice(
          0,
          VOICE_LOG_MAX,
        ),
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError((err as Error).message);
    } finally {
      if (abortRef.current === controller) setBusy(false);
    }
  }

  async function copyLatest() {
    if (!latest) return;
    try {
      await navigator.clipboard.writeText(latest.text);
      setCopied(true);
    } catch {
      setError("The browser blocked copying.");
    }
  }

  const ready = settings !== null;

  return (
    <Card>
      <CardHeader
        icon={MessageSquareQuote}
        trailing={
          <button
            type="button"
            className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-1.5 text-xs text-muted hover:text-ink"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="size-3.5" aria-hidden />
            AI settings
          </button>
        }
      >
        Say it like Gary
      </CardHeader>
      <CardBody>
        <Stack gap={12}>
          <label className="flex flex-col gap-1">
            <span className={LABEL}>What’s happening? (optional)</span>
            <textarea
              className={cx(FIELD, "resize-none leading-snug")}
              rows={2}
              placeholder="e.g. The yuan-ti priest calls us weaklings"
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
            />
          </label>

          <div className="grid grid-cols-3 gap-1.5">
            {ASKS.map((a) => (
              <button
                key={a.id}
                type="button"
                className="inline-flex min-h-10 min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-line bg-well/70 px-1.5 text-[0.8rem] text-ink transition-colors hover:border-gold/50 hover:bg-raised/60 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!ready || busy}
                onClick={() => void generate(a)}
              >
                <a.icon className="size-3.5 shrink-0 text-gold/80" aria-hidden />
                <span className="truncate">{a.label}</span>
              </button>
            ))}
          </div>

          <Button
            variant="primary"
            icon={MessageSquareQuote}
            disabled={!ready || busy}
            onClick={() => void generate(null)}
          >
            Say something that fits
          </Button>

          <div
            className="flex h-36 flex-col rounded-xl border border-gold/30 bg-gradient-to-b from-raised/50 to-well/70"
            aria-live="polite"
          >
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-3 text-center">
              {!ready ? (
                <div className="flex flex-col items-center gap-2 text-sm text-faint">
                  <KeyRound className="size-5" aria-hidden />
                  Add a free Groq key to generate lines.
                  <Button size="sm" icon={Settings} onClick={() => setSettingsOpen(true)}>
                    Set up AI
                  </Button>
                </div>
              ) : busy ? (
                <span className="inline-flex items-center gap-2 text-sm text-muted">
                  <LoaderCircle className="size-4 animate-spin text-gold" aria-hidden />
                  Gary is thinking…
                </span>
              ) : error ? (
                <span className="inline-flex items-start gap-2 text-left text-sm text-crimson-soft">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {error}
                </span>
              ) : latest ? (
                <p
                  key={latest.id}
                  className="m-0 animate-pop-in font-display text-[1.05rem] leading-snug text-gold-soft"
                >
                  {latest.text}
                </p>
              ) : (
                <span className="text-sm text-faint">
                  Pick a prompt above. Gary’s line shows here.
                </span>
              )}
            </div>
            <div className="flex h-9 shrink-0 items-center justify-end gap-1 border-t border-line/70 px-2">
              <button
                type="button"
                className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-1.5 text-xs text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!ready || busy || !lastAsk}
                onClick={() => void generate(lastAsk)}
              >
                <RefreshCw className="size-3.5" aria-hidden />
                Another {lastAsk ? lastAsk.label.toLowerCase() : "one"}
              </button>
              <button
                type="button"
                className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-1.5 text-xs text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!latest || busy}
                onClick={() => void copyLatest()}
              >
                {copied ? (
                  <Check className="size-3.5 text-verdant" aria-hidden />
                ) : (
                  <Copy className="size-3.5" aria-hidden />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex h-6 items-center justify-between">
              <span className={cx(LABEL, "inline-flex items-center gap-1")}>
                <ScrollText className="size-3 text-gold/70" aria-hidden />
                Earlier lines
              </span>
              <button
                type="button"
                className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-md px-1.5 text-xs text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                disabled={log.length === 0}
                onClick={() => setLog([])}
              >
                <Trash2 className="size-3.5" aria-hidden />
                Clear
              </button>
            </div>
            <ol className="m-0 flex h-40 list-none flex-col gap-1.5 overflow-y-auto rounded-lg border border-line bg-well/30 p-2">
              {log.length > 1 ? (
                log.slice(1).map((line) => (
                  <li key={line.id} className="shrink-0 text-[0.85rem] leading-snug text-muted">
                    <span className="mr-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-faint">
                      {line.label}
                    </span>
                    {line.text}
                  </li>
                ))
              ) : (
                <li className="text-[0.85rem] text-faint">No earlier lines.</li>
              )}
            </ol>
          </div>
        </Stack>
      </CardBody>

      <Drawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="AI settings"
        icon={KeyRound}
      >
        <AiSettingsForm
          initial={settings}
          onSave={(next) => {
            saveAiSettings(next);
            setSettings(next);
            setError(null);
            setSettingsOpen(false);
          }}
        />
      </Drawer>
    </Card>
  );
}

function AiSettingsForm({
  initial,
  onSave,
}: {
  initial: AiSettings | null;
  onSave: (next: AiSettings | null) => void;
}) {
  const [provider, setProvider] = useState<AiProvider>(
    initial?.provider ?? "groq",
  );
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? "");
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? "");
  const [model, setModel] = useState(
    initial?.model ?? DEFAULT_MODELS[initial?.provider ?? "groq"],
  );
  const [models, setModels] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<{ ok: boolean; text: string } | null>(null);
  const info = PROVIDERS[provider];

  async function checkKey() {
    setChecking(true);
    setCheck(null);
    try {
      const ids = await listModels(provider, apiKey.trim(), baseUrl.trim());
      setModels(ids);
      if (!model || !ids.includes(model)) setModel(suggestModel(provider, ids));
      setCheck({ ok: true, text: `Key works · ${ids.length} models available.` });
    } catch (err) {
      setCheck({ ok: false, text: (err as Error).message });
    } finally {
      setChecking(false);
    }
  }

  const trimmedKey = apiKey.trim();
  const canSave =
    !!model.trim() &&
    (provider === "compatible" ? !!baseUrl.trim() : !!trimmedKey);

  return (
    <Stack gap={14}>
      <Text tone="secondary">
        Groq is free and does not ask for a card. Sign in at console.groq.com
        with Google, GitHub, or email, leave the plan on Free, create a key,
        and paste it here. The key stays in this browser.
      </Text>

      <label className="flex flex-col gap-1">
        <span className={LABEL}>Provider</span>
        <select
          className={FIELD}
          value={provider}
          onChange={(e) => {
            const next = e.target.value as AiProvider;
            setProvider(next);
            setModel(DEFAULT_MODELS[next]);
            setModels([]);
            setCheck(null);
          }}
        >
          {PROVIDER_ORDER.map((p) => (
            <option key={p} value={p}>
              {PROVIDERS[p].label}
            </option>
          ))}
        </select>
        <span className="text-xs text-faint">{info.blurb}</span>
      </label>

      {provider === "compatible" ? (
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Base URL</span>
          <input
            className={cx(FIELD, "font-mono")}
            spellCheck={false}
            placeholder="https://openrouter.ai/api/v1"
            value={baseUrl}
            onChange={(e) => {
              setBaseUrl(e.target.value);
              setCheck(null);
            }}
          />
        </label>
      ) : null}

      <label className="flex flex-col gap-1">
        <span className={LABEL}>API key</span>
        <input
          className={cx(FIELD, "font-mono")}
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={info.keyHint}
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value);
            setCheck(null);
          }}
        />
        <a
          className="inline-flex w-fit items-center gap-1 text-xs"
          href={info.keyUrl}
          target="_blank"
          rel="noreferrer"
        >
          Get a {info.label} key
          <ExternalLink className="size-3" aria-hidden />
        </a>
      </label>

      <Button
        variant="secondary"
        icon={checking ? LoaderCircle : Check}
        disabled={
          checking ||
          (provider === "compatible" ? !baseUrl.trim() : !trimmedKey)
        }
        onClick={() => void checkKey()}
      >
        Check key & load models
      </Button>
      <div
        className={cx(
          "min-h-5 text-xs",
          check ? (check.ok ? "text-verdant" : "text-crimson-soft") : "text-faint",
        )}
      >
        {check?.text ?? "Optional, but confirms the key before you need it."}
      </div>

      <label className="flex flex-col gap-1">
        <span className={LABEL}>Model</span>
        {models.length > 0 ? (
          <select
            className={FIELD}
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            {models.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        ) : (
          <input
            className={cx(FIELD, "font-mono")}
            spellCheck={false}
            placeholder={
              provider === "openai" || provider === "compatible"
                ? "Check the key to list models"
                : info.defaultModel || "Model id"
            }
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
        )}
        <span className="text-xs text-faint">
          {provider === "groq"
            ? "This model is on Groq’s free plan. Leave the account on Free. Upgrading to Developer is what starts billing."
            : provider === "gemini"
              ? "Gemini’s free tier is a Google AI Studio key, not a Gemini Pro subscription. Skip “Set up billing.”"
              : "This provider charges. A small model is a fraction of a cent per line. Set a spend limit on the key."}
        </span>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="danger"
          icon={Trash2}
          disabled={!initial}
          onClick={() => onSave(null)}
        >
          Remove key
        </Button>
        <Button
          variant="primary"
          icon={Check}
          disabled={!canSave}
          onClick={() =>
            onSave({
              provider,
              apiKey: trimmedKey,
              model: model.trim(),
              baseUrl: provider === "compatible" ? baseUrl.trim() : undefined,
            })
          }
        >
          Save
        </Button>
      </div>
    </Stack>
  );
}
