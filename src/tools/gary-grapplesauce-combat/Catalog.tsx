import { useState, type ReactNode } from "react";
import { BookOpen, LoaderCircle, Plus, Trash2 } from "lucide-react";
import {
  ACTION_PARTS,
  ACTIONS,
  PART_LABEL,
  type ActionPart,
  type CustomAction,
  type GameAction,
} from "./actions";
import { PLAYBOOKS, type CustomPlaybook, type PlaybookWhen } from "./playbooks";
import { CostChips } from "./CostChips";
import { actionChips, type UsageSheet } from "./cost";
import { blockReason, toSpendTarget, type SpendFields } from "./spend";
import { useRollLog } from "./rollLog";
import { Button, Card, CardBody, CardHeader, Drawer, Stack, Text } from "../../ui";

const FIELD =
  "w-full appearance-none rounded-lg border border-line bg-well px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-gold/70";
const LABEL = "text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-faint";

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

const WHEN: { id: PlaybookWhen; label: string }[] = [
  { id: "turn", label: "My turn" },
  { id: "reaction", label: "Reaction" },
  { id: "check", label: "Failed roll" },
];

const BROWSER_PARTS: { id: ActionPart; label: string }[] = [
  { id: "action", label: "Action" },
  { id: "bonus", label: "Bonus" },
  { id: "reaction", label: "Reaction" },
  { id: "free", label: "Other" },
];

/** Grouped list of everything Gary can do, on the Play tab. */
export function ActionBrowser({
  customActions,
  sheet,
  cantAct,
  bloodied,
  note,
  rollHold,
  canUndo,
  follow,
  onUse,
  onUndo,
  onHit,
  onMiss,
  onSwaggerFailed,
  onSwaggerKept,
  rolls,
}: {
  customActions: CustomAction[];
  sheet?: UsageSheet & Pick<SpendFields, "exhaustion">;
  cantAct: boolean;
  bloodied: boolean;
  note: string | null;
  /** When set, the note names a die that is still on screen. */
  rollHold: { id: string; hold: string } | null;
  canUndo: boolean;
  /** A Haymaker or Swagger spend is waiting for the second tap. */
  follow: "haymaker" | "swagger" | null;
  onUse: (action: GameAction | CustomAction) => void;
  onUndo: () => void;
  onHit: () => void;
  onMiss: () => void;
  onSwaggerFailed: () => void;
  onSwaggerKept: () => void;
  rolls?: (action: GameAction | CustomAction) => ReactNode;
}) {
  const [part, setPart] = useState<ActionPart>("action");
  const [picked, setPicked] = useState<string | null>(null);
  const items = [...ACTIONS, ...customActions].filter((action) => action.part === part);
  const current = items.find((action) => action.id === picked) ?? null;
  const pendingSame =
    (follow === "haymaker" && current?.id === "haymaker") ||
    (follow === "swagger" && current?.id === "swagger");
  const blocked =
    current && sheet
      ? pendingSame
        ? follow === "haymaker"
          ? "Say whether it hit."
          : "Say whether the check still failed."
        : blockReason(toSpendTarget(current), readyFlags(sheet), { cantAct, bloodied })
      : null;
  const { pendingId } = useRollLog();
  const shown =
    follow && note
      ? note
      : (blocked ?? note ?? "Tap a move, then Use. Undo puts the last one back.");
  const holding = rollHold != null && rollHold.id === pendingId && shown === note;
  const followMode =
    follow ??
    (current?.id === "haymaker" || current?.id === "swagger" ? current.id : null);

  return (
    <Card>
      <CardHeader icon={BookOpen}>What you can do</CardHeader>
      <CardBody>
        <Stack gap={10}>
          <div
            className="grid grid-cols-4 gap-1 rounded-lg border border-line bg-well/70 p-1"
            role="tablist"
          >
            {BROWSER_PARTS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={part === item.id}
                className={
                  part === item.id
                    ? "min-h-10 cursor-pointer rounded-md bg-surface text-sm font-semibold text-gold-soft"
                    : "min-h-10 cursor-pointer rounded-md text-sm font-semibold text-muted hover:text-ink"
                }
                onClick={() => {
                  setPart(item.id);
                  setPicked(null);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <ul className="m-0 flex h-52 list-none flex-col gap-1 overflow-y-auto rounded-lg border border-line bg-well/30 p-1">
            {items.map((action) => {
              const on = current?.id === action.id;
              return (
                <li key={action.id}>
                  <button
                    type="button"
                    className={
                      on
                        ? "flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-md bg-gold/10 px-2 text-left text-sm text-gold-soft"
                        : "flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-sm text-ink hover:bg-raised/60"
                    }
                    aria-pressed={on}
                    onClick={() => setPicked(action.id)}
                  >
                    <span className="min-w-0 flex-1 truncate">{action.name}</span>
                    <CostChips labels={actionChips(action, sheet)} />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex min-h-16 items-center rounded-lg border border-dashed border-line px-3 py-2 text-sm leading-snug text-muted">
            {current ? current.summary || "No details yet." : "Tap a move to read it."}
          </div>
          <div
            className={
              (follow && note) || holding
                ? "flex min-h-11 items-center rounded-lg border border-gold/30 bg-gold/[0.06] px-3 py-2 text-sm leading-snug text-gold-soft"
                : "flex min-h-11 items-center rounded-lg border border-dashed border-line px-3 py-2 text-sm leading-snug text-muted"
            }
            aria-live="polite"
            aria-busy={holding}
          >
            {holding && rollHold ? (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <LoaderCircle
                  className="size-3.5 shrink-0 animate-spin"
                  aria-label="Dice still rolling"
                />
                <span className="min-w-0">{rollHold.hold}</span>
              </span>
            ) : (
              shown
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="primary"
              className="w-full"
              disabled={!current || blocked != null}
              aria-label={current ? `Use ${current.name}` : "Use"}
              onClick={() => {
                if (current) onUse(current);
              }}
            >
              Use
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              disabled={!canUndo}
              aria-label="Undo last use"
              onClick={onUndo}
            >
              Undo
            </Button>
          </div>
          {followMode === "haymaker" ? (
            <div className="grid min-h-11 grid-cols-2 gap-2">
              <Button
                variant="secondary"
                disabled={follow !== "haymaker"}
                onClick={onHit}
              >
                Hit
              </Button>
              <Button
                variant="secondary"
                disabled={follow !== "haymaker"}
                onClick={onMiss}
              >
                Miss
              </Button>
            </div>
          ) : followMode === "swagger" ? (
            <div className="grid min-h-11 grid-cols-2 gap-2">
              <Button
                variant="secondary"
                disabled={follow !== "swagger"}
                onClick={onSwaggerFailed}
              >
                Still failed
              </Button>
              <Button
                variant="secondary"
                disabled={follow !== "swagger"}
                onClick={onSwaggerKept}
              >
                Succeeded
              </Button>
            </div>
          ) : (
            <div className="flex min-h-11 items-center rounded-lg border border-dashed border-line px-3 text-sm text-faint">
              Follow-up, when a move needs one.
            </div>
          )}
          {current && rolls ? rolls(current) : null}
        </Stack>
      </CardBody>
    </Card>
  );
}

function readyFlags(sheet: UsageSheet & Pick<SpendFields, "exhaustion">): SpendFields {
  return {
    moxie: sheet.moxie,
    tempHp: 0,
    digDeep: sheet.digDeep,
    digDeepActive: sheet.digDeepActive,
    bloodiedUnbowed: sheet.bloodiedUnbowed,
    swagger: sheet.swagger,
    guardedMind: sheet.guardedMind,
    downButNotOut: sheet.downButNotOut,
    exhaustion: sheet.exhaustion,
  };
}

export function ActionCatalog({
  open,
  onClose,
  customActions,
  setCustomActions,
  customPlaybooks,
  setCustomPlaybooks,
  sheet,
}: {
  open: boolean;
  onClose: () => void;
  customActions: CustomAction[];
  setCustomActions: (
    next: CustomAction[] | ((prev: CustomAction[]) => CustomAction[]),
  ) => void;
  customPlaybooks: CustomPlaybook[];
  setCustomPlaybooks: (
    next: CustomPlaybook[] | ((prev: CustomPlaybook[]) => CustomPlaybook[]),
  ) => void;
  sheet?: UsageSheet;
}) {
  const [name, setName] = useState("");
  const [part, setPart] = useState<ActionPart>("action");
  const [summary, setSummary] = useState("");
  const [moxie, setMoxie] = useState("0");
  const [bookTitle, setBookTitle] = useState("");
  const [bookBlurb, setBookBlurb] = useState("");
  const [bookWhen, setBookWhen] = useState<PlaybookWhen>("turn");
  const [bookIds, setBookIds] = useState<string[]>([]);

  const all: (GameAction | CustomAction)[] = [...ACTIONS, ...customActions];

  function addAction() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const cost = Math.max(0, Math.min(5, Number.parseInt(moxie || "0", 10) || 0));
    setCustomActions((prev) => [
      { id: newId("custom"), name: trimmed, part, summary: summary.trim(), moxie: cost },
      ...prev,
    ]);
    setName("");
    setSummary("");
    setMoxie("0");
  }

  function removeAction(id: string) {
    setCustomActions((prev) => prev.filter((action) => action.id !== id));
    setCustomPlaybooks((prev) =>
      prev.map((book) => ({
        ...book,
        actionIds: book.actionIds.filter((x) => x !== id),
      })),
    );
    setBookIds((ids) => ids.filter((x) => x !== id));
  }

  function addPlaybook() {
    const title = bookTitle.trim();
    if (!title || bookIds.length === 0) return;
    setCustomPlaybooks((prev) => [
      {
        id: newId("book"),
        title,
        blurb: bookBlurb.trim() || "Custom playbook.",
        when: bookWhen,
        actionIds: bookIds,
      },
      ...prev,
    ]);
    setBookTitle("");
    setBookBlurb("");
    setBookIds([]);
  }

  return (
    <Drawer open={open} onClose={onClose} title="Actions" icon={BookOpen}>
      <Stack gap={16}>
        <Text tone="secondary">
          Every move Gary can make lives here. Playbooks only point at this list. Add your
          own when the sheet grows.
        </Text>

        <div className="flex flex-col gap-1.5">
          <span className={LABEL}>Add an action</span>
          <input
            className={FIELD}
            placeholder="Name"
            aria-label="New action name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="grid grid-cols-[1fr_5rem] gap-1.5">
            <select
              className={FIELD}
              aria-label="When it is used"
              value={part}
              onChange={(e) => setPart(e.target.value as ActionPart)}
            >
              {ACTION_PARTS.map((id) => (
                <option key={id} value={id}>
                  {PART_LABEL[id]}
                </option>
              ))}
            </select>
            <input
              className={`${FIELD} text-center tabular-nums`}
              inputMode="numeric"
              aria-label="Moxie cost"
              value={moxie}
              onChange={(e) => setMoxie(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <textarea
            className={`${FIELD} min-h-16 resize-none`}
            placeholder="What it does"
            aria-label="Action summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
          <Button
            variant="primary"
            icon={Plus}
            disabled={name.trim() === ""}
            onClick={addAction}
          >
            Add action
          </Button>
        </div>

        <ul className="m-0 flex h-64 list-none flex-col gap-1.5 overflow-y-auto rounded-xl border border-line bg-well/30 p-1.5">
          {all.map((action) => {
            const custom = customActions.some((item) => item.id === action.id);
            return (
              <li
                key={action.id}
                className="flex min-h-12 shrink-0 items-start gap-2 rounded-lg border border-line bg-surface/80 px-2 py-1.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">
                    {action.name}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <CostChips labels={actionChips(action, sheet)} />
                    {custom ? (
                      <span className="inline-flex h-5 items-center rounded-full border border-line bg-well/80 px-1.5 text-[0.62rem] font-semibold tracking-wide text-muted">
                        Yours
                      </span>
                    ) : null}
                  </div>
                  {action.summary ? (
                    <p className="mt-0.5 text-xs leading-snug text-muted">
                      {action.summary}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-faint hover:text-crimson-soft disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label={`Remove ${action.name}`}
                  disabled={!custom}
                  onClick={() => removeAction(action.id)}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col gap-1.5">
          <span className={LABEL}>Add a playbook</span>
          <input
            className={FIELD}
            placeholder="Name, e.g. Hold the door"
            aria-label="New playbook name"
            value={bookTitle}
            onChange={(e) => setBookTitle(e.target.value)}
          />
          <input
            className={FIELD}
            placeholder="One line on when to use it"
            aria-label="Playbook summary"
            value={bookBlurb}
            onChange={(e) => setBookBlurb(e.target.value)}
          />
          <select
            className={FIELD}
            aria-label="Playbook shows up when"
            value={bookWhen}
            onChange={(e) => setBookWhen(e.target.value as PlaybookWhen)}
          >
            {WHEN.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <div className="flex h-36 flex-col gap-1 overflow-y-auto rounded-lg border border-line p-1.5">
            {all.map((action) => {
              const on = bookIds.includes(action.id);
              return (
                <label
                  key={action.id}
                  className="flex min-h-8 cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-gold"
                    checked={on}
                    onChange={() =>
                      setBookIds((ids) =>
                        on ? ids.filter((id) => id !== action.id) : [...ids, action.id],
                      )
                    }
                  />
                  <span className="min-w-0 flex-1 truncate">{action.name}</span>
                </label>
              );
            })}
          </div>
          <Button
            variant="secondary"
            icon={Plus}
            disabled={bookTitle.trim() === "" || bookIds.length === 0}
            onClick={addPlaybook}
          >
            Add playbook
          </Button>
        </div>

        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {[...customPlaybooks, ...PLAYBOOKS].map((book) => {
            const custom = customPlaybooks.some((item) => item.id === book.id);
            return (
              <li
                key={book.id}
                className="flex min-h-10 items-center gap-2 rounded-lg border border-line px-2.5 py-1.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-ink">{book.title}</div>
                  <div className="truncate text-xs text-faint">
                    {book.actionIds.length} actions{custom ? " · yours" : ""}
                  </div>
                </div>
                <button
                  type="button"
                  className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-faint hover:text-crimson-soft disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label={`Remove ${book.title}`}
                  disabled={!custom}
                  onClick={() =>
                    setCustomPlaybooks((prev) =>
                      prev.filter((item) => item.id !== book.id),
                    )
                  }
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      </Stack>
    </Drawer>
  );
}
