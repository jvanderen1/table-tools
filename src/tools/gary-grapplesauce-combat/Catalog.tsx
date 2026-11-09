import { useState } from "react";
import { BookOpen, Plus, Trash2 } from "lucide-react";
import {
  ACTION_PARTS,
  ACTIONS,
  PART_LABEL,
  type ActionPart,
  type CustomAction,
  type GameAction,
} from "./actions";
import {
  PLAYBOOKS,
  type CustomPlaybook,
  type PlaybookWhen,
} from "./playbooks";
import { Button, Drawer, Stack, Text } from "../../ui";

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

export function ActionCatalog({
  open,
  onClose,
  customActions,
  setCustomActions,
  customPlaybooks,
  setCustomPlaybooks,
}: {
  open: boolean;
  onClose: () => void;
  customActions: CustomAction[];
  setCustomActions: (next: CustomAction[] | ((prev: CustomAction[]) => CustomAction[])) => void;
  customPlaybooks: CustomPlaybook[];
  setCustomPlaybooks: (
    next: CustomPlaybook[] | ((prev: CustomPlaybook[]) => CustomPlaybook[]),
  ) => void;
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
      prev.map((book) => ({ ...book, actionIds: book.actionIds.filter((x) => x !== id) })),
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
          Every move Gary can make lives here. Playbooks only point at this list.
          Add your own when the sheet grows.
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
          <Button variant="primary" icon={Plus} disabled={name.trim() === ""} onClick={addAction}>
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
                  <div className="truncate text-sm font-medium text-ink">{action.name}</div>
                  <div className="text-xs text-faint">
                    {PART_LABEL[action.part]}
                    {action.moxie > 0 ? ` · ${action.moxie} Moxie` : ""}
                    {custom ? " · yours" : ""}
                  </div>
                  {action.summary ? (
                    <p className="mt-0.5 text-xs leading-snug text-muted">{action.summary}</p>
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
                <label key={action.id} className="flex min-h-8 cursor-pointer items-center gap-2 text-sm">
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
                    setCustomPlaybooks((prev) => prev.filter((item) => item.id !== book.id))
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
