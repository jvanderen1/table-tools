import {
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
} from "react";
import { usePersistentState } from "../../lib/usePersistentState";
import {
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Pill,
  Row,
  Spacer,
  Stack,
  Text,
} from "../../ui";

type Phase = "timing" | "reaction" | "goal" | "result";
type Timing = "turn" | "reaction" | "check-fail";
type ReactionKind = "bloodied" | "mage-cast" | "opportunity" | "other";
type Goal =
  | "damage"
  | "control"
  | "survive"
  | "reposition"
  | "mage"
  | "unsure";

type Plan = {
  title: string;
  action: string;
  bonus: string;
  reaction?: string;
  cost: number;
  costLabel: string;
  why: string;
  gym: string;
  /** What “Apply” does to the tracker */
  apply?: "moxie" | "bloodied-unbowed" | "dig-deep" | "swagger" | "none";
};

const CONDITION_DEFS = [
  { id: "blinded", label: "Blinded" },
  { id: "charmed", label: "Charmed" },
  { id: "deafened", label: "Deafened" },
  { id: "frightened", label: "Frightened" },
  { id: "grappled", label: "Grappled" },
  { id: "incapacitated", label: "Incapacitated" },
  { id: "invisible", label: "Invisible" },
  { id: "paralyzed", label: "Paralyzed" },
  { id: "petrified", label: "Petrified" },
  { id: "poisoned", label: "Poisoned" },
  { id: "prone", label: "Prone" },
  { id: "restrained", label: "Restrained" },
  { id: "stunned", label: "Stunned" },
  { id: "unconscious", label: "Unconscious" },
] as const;

type ConditionId = (typeof CONDITION_DEFS)[number]["id"];
type ConditionFlags = Record<ConditionId, boolean>;

type Sheet = {
  moxie: number;
  hp: number;
  tempHp: number;
  /** Remaining uses — true = still available */
  digDeep: boolean;
  digDeepActive: boolean;
  bloodiedUnbowed: boolean;
  swagger: boolean;
  conditions: ConditionFlags;
  /** 0 = none, 1–6 = Exhaustion level */
  exhaustion: number;
};

const MOXIE_MAX = 5;
const HP_MAX = 103;
const BLOODIED_AT = Math.floor(HP_MAX / 2); // ≤ 51

function emptyConditions(): ConditionFlags {
  return Object.fromEntries(
    CONDITION_DEFS.map((c) => [c.id, false]),
  ) as ConditionFlags;
}

const DEFAULT_SHEET: Sheet = {
  moxie: MOXIE_MAX,
  hp: HP_MAX,
  tempHp: 0,
  digDeep: true,
  digDeepActive: false,
  bloodiedUnbowed: true,
  swagger: true,
  conditions: emptyConditions(),
  exhaustion: 0,
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeSheet(raw: Sheet): Sheet {
  return {
    ...DEFAULT_SHEET,
    ...raw,
    conditions: { ...emptyConditions(), ...(raw.conditions ?? {}) },
    exhaustion: clamp(raw.exhaustion ?? 0, 0, 6),
  };
}

function activeConditions(sheet: Sheet): { id: ConditionId; label: string }[] {
  return CONDITION_DEFS.filter((c) => sheet.conditions?.[c.id]);
}

const CHEAT = {
  attack: "+9 / 1d10+5 bludgeoning",
  ac: "18",
  athletics: "+13",
  saves: "Str +10 · Con +8 · others +1 from Towel",
};

type GoalOption = {
  id: Goal;
  label: string;
  cost: number;
  variant: "primary" | "secondary" | "ghost";
};

const GOAL_OPTIONS: GoalOption[] = [
  { id: "damage", label: "Deal damage", cost: 0, variant: "primary" },
  { id: "control", label: "Grapple / control", cost: 0, variant: "secondary" },
  { id: "survive", label: "Survive", cost: 0, variant: "secondary" },
  {
    id: "reposition",
    label: "Move / close gap (Stick and Move)",
    cost: 1,
    variant: "secondary",
  },
  { id: "mage", label: "Stop a caster", cost: 0, variant: "secondary" },
  { id: "unsure", label: "Not sure", cost: 0, variant: "ghost" },
];

function isBloodied(hp: number) {
  return hp > 0 && hp <= BLOODIED_AT;
}

function planFor(goal: Goal, sheet: Sheet): Plan {
  const canSpend = sheet.moxie >= 1;

  switch (goal) {
    case "damage":
      return canSpend
        ? {
            title: "Damage focus",
            action:
              "Attack → Unarmed Strike. On hit, Heavy Hitter: deal damage and Grapple or Shove.",
            bonus: "One-Two Punch (1 Moxie): two more Unarmed Strikes.",
            cost: 1,
            costLabel: "1",
            why: "Action punch + Heavy Hitter, then burst with One-Two while you have Moxie.",
            gym: 'The One-Two. "Cardio."',
            apply: "moxie",
          }
        : {
            title: "Damage focus (no Moxie)",
            action:
              "Attack → Unarmed Strike. On hit, Heavy Hitter: deal damage and Grapple or Shove.",
            bonus: "Fisticuffs free Unarmed Strike (no Moxie).",
            cost: 0,
            costLabel: "0",
            why: "Same Action loop; free BA punch only until you regain Moxie.",
            gym: 'The One-Two. "Cardio."',
            apply: "none",
          };
    case "control":
      return {
        title: "Lock them down",
        action:
          "Attack → Unarmed. On hit, Stop and Drop: Grapple and Shove (no mastery).",
        bonus: canSpend
          ? "Hold Inescapable for their escape attempt (1 Moxie). Until then, Fisticuffs Unarmed or shove prone."
          : "Fisticuffs Unarmed, or shove prone if already grappled. Inescapable locked until you have 1 Moxie.",
        cost: 0,
        costLabel: canSpend ? "0 now · 1 later" : "0",
        why: "Compression Lock deals 1d10+5 at the start of your turns while you hold them.",
        gym: "Sit Down. Still Hugging.",
        apply: "none",
      };
    case "survive":
      if (canSpend) {
        return {
          title: "Stay standing",
          action:
            "Attack only if safe. Prefer holding position or Disengaging later.",
          bonus: sheet.digDeep
            ? "Brace Up (1 Moxie): temp HP = 1d10 + 12. Dig Deep still available (1/long rest)."
            : "Brace Up (1 Moxie): temp HP = 1d10 + 12. Dig Deep already used.",
          reaction: sheet.bloodiedUnbowed
            ? "If bloodied and you take damage: Bloodied But Unbowed still available."
            : "Bloodied But Unbowed already used this short rest.",
          cost: 1,
          costLabel: "1",
          why: "Temp HP now. Dig Deep is free but once per long rest.",
          gym: "Flex. Leg Day.",
          apply: "moxie",
        };
      }
      if (sheet.digDeep) {
        return {
          title: "Stay standing — Dig Deep",
          action:
            "Attack only if safe. Hold position behind allies if possible.",
          bonus:
            "Dig Deep (1/long rest): resistance to B/P/S for 10 minutes. Brace Up locked (no Moxie).",
          cost: 0,
          costLabel: "0 · Dig Deep",
          why: "No Brace Up without Moxie. Burn Dig Deep if the fight is brutal.",
          gym: "Leg Day.",
          apply: "dig-deep",
        };
      }
      return {
        title: "Stay standing (no tools left)",
        action:
          "Attack only if safe. Hold position behind allies if possible.",
        bonus:
          "Brace Up locked (no Moxie). Dig Deep already used. Hope for Bloodied But Unbowed or cover.",
        cost: 0,
        costLabel: "0",
        why: "You’re on fumes — play scared and wait for a rest or refill reaction.",
        gym: "Breathe.",
        apply: "none",
      };
    case "reposition":
      return {
        title: "Close or bounce",
        action:
          "Attack if in reach after Stick and Move; otherwise arrive ready for next turn.",
        bonus: "Stick and Move (1 Moxie): Unarmed Strike + Dash or Disengage.",
        cost: 1,
        costLabel: "1",
        why: "One resource buys offense and movement without burning your Action on Dash alone.",
        gym: "Bounce, don't plant.",
        apply: "moxie",
      };
    case "mage":
      return canSpend
        ? {
            title: "Shut down the caster",
            action:
              "Get adjacent. Attack with advantage from Mage Slayer when they cast. Grapple if you can keep them stuck.",
            bonus:
              "Stick and Move (1 Moxie) to close, or One-Two (1 Moxie) once adjacent.",
            reaction:
              "When a creature within 5 ft casts a spell with a spell slot: Mage Slayer reaction Unarmed Strike.",
            cost: 1,
            costLabel: "1",
            why: "Spend Moxie to get on them or burst once you're there.",
            gym: "HEY. Soften the wizard.",
            apply: "moxie",
          }
        : {
            title: "Shut down the caster (no Moxie)",
            action:
              "Dash or move adjacent with your Action/movement. Attack if you arrive. Grapple if you can.",
            bonus: "Fisticuffs Unarmed once you're on them.",
            reaction:
              "When a creature within 5 ft casts a spell with a spell slot: Mage Slayer reaction Unarmed Strike.",
            cost: 0,
            costLabel: "0",
            why: "Stick and Move / One-Two locked. Still interrupt with Mage Slayer.",
            gym: "HEY. Soften the wizard.",
            apply: "none",
          };
    default:
      return {
        title: "Default loop",
        action:
          "Attack → Unarmed. Heavy Hitter on hit (damage + Grapple or Shove).",
        bonus: "Fisticuffs free Unarmed Strike. Save Moxie for a bad turn.",
        cost: 0,
        costLabel: "0",
        why: "Punch, hug, repeat. Spend Moxie only when the board state demands it.",
        gym: "If unsure: punch, then offer a spot.",
        apply: "none",
      };
  }
}

function reactionPlan(kind: ReactionKind): Plan {
  switch (kind) {
    case "bloodied":
      return {
        title: "Bloodied But Unbowed",
        action: "No Action — this is a Reaction.",
        bonus: "—",
        reaction:
          "Spend your Reaction: regain all Moxie Points and gain 36 temporary HP (1/short rest).",
        cost: 0,
        costLabel: "refill Moxie + 36 temp",
        why: "Only when you take damage while bloodied. Biggest swing button in the kit.",
        gym: "Not done. Spot me.",
        apply: "bloodied-unbowed",
      };
    case "mage-cast":
      return {
        title: "Mage Slayer interrupt",
        action: "No Action — this is a Reaction.",
        bonus: "—",
        reaction:
          "Creature within 5 ft casts with a spell slot → Reaction Unarmed Strike (+9 / 1d10+5). Next turn, stay adjacent.",
        cost: 0,
        costLabel: "0",
        why: "Interrupt first. Follow up by grappling them so they can't walk off.",
        gym: "HEY.",
        apply: "none",
      };
    case "opportunity":
      return {
        title: "Opportunity Attack",
        action: "No Action — this is a Reaction.",
        bonus: "—",
        reaction: "Unarmed Strike. Save Grapple / Stop and Drop for your turn.",
        cost: 0,
        costLabel: "0",
        why: "Punish leaving your reach.",
        gym: "Where you going?",
        apply: "none",
      };
    default:
      return {
        title: "Hold the Reaction",
        action: "No forced Reaction.",
        bonus: "—",
        reaction:
          "Keep Reaction free for Bloodied But Unbowed or Mage Slayer unless an OA is clearly better.",
        cost: 0,
        costLabel: "0",
        why: "Your two signature Reactions are high value. Don't spend casually.",
        gym: "Save the flex.",
        apply: "none",
      };
  }
}

function checkFailPlan(swaggerAvailable: boolean): Plan {
  if (!swaggerAvailable) {
    return {
      title: "Swagger Streak already used",
      action: "No Action — Swagger Streak is spent until a short rest.",
      bonus: "—",
      cost: 0,
      costLabel: "0",
      why: "Take the fail, or hope for Help / advantage from an ally.",
      gym: "Shake it off.",
      apply: "none",
    };
  }
  return {
    title: "Swagger Streak",
    action: "No Action — after you fail a Str, Dex, Con, or Cha check.",
    bonus: "—",
    reaction: "Add 1d10 to the failed check (1/short rest).",
    cost: 0,
    costLabel: "0 · 1/SR",
    why: "Use on Athletics grapples/shoves or key Str/Dex/Con/Cha checks you can't afford to miss.",
    gym: "One more rep.",
    apply: "swagger",
  };
}

const DAMAGE_TYPES = [
  "bludgeoning",
  "piercing",
  "slashing",
  "acid",
  "cold",
  "fire",
  "force",
  "lightning",
  "necrotic",
  "poison",
  "psychic",
  "radiant",
  "thunder",
] as const;

type DamageType = (typeof DAMAGE_TYPES)[number];
type Effectiveness = "auto" | "normal" | "resistant" | "immune" | "vulnerable";

type DamageUi = {
  amount: string;
  type: DamageType;
  effectiveness: Effectiveness;
  increments: number[];
  customIncrement: string;
};

const DEFAULT_DAMAGE_UI: DamageUi = {
  amount: "0",
  type: "bludgeoning",
  effectiveness: "auto",
  increments: [1, 5, 10, 20],
  customIncrement: "15",
};

type DamageOutcome = {
  tone: "info" | "warning";
  title: string;
  detail: string;
};

function isWeaponPhysical(type: DamageType) {
  return (
    type === "bludgeoning" || type === "piercing" || type === "slashing"
  );
}

function resolveEffectiveness(
  type: DamageType,
  digDeepActive: boolean,
  mode: Effectiveness,
): Exclude<Effectiveness, "auto"> {
  if (mode !== "auto") return mode;
  if (digDeepActive && isWeaponPhysical(type)) return "resistant";
  return "normal";
}

function modifyDamage(
  raw: number,
  eff: Exclude<Effectiveness, "auto">,
): number {
  if (eff === "immune") return 0;
  if (eff === "resistant") return Math.floor(raw / 2);
  if (eff === "vulnerable") return raw * 2;
  return raw;
}

function applyIncomingDamage(
  hp: number,
  tempHp: number,
  finalDamage: number,
): { hp: number; tempHp: number; absorbedByTemp: number; toHp: number } {
  let remaining = finalDamage;
  let nextTemp = tempHp;
  let absorbedByTemp = 0;
  if (nextTemp > 0 && remaining > 0) {
    absorbedByTemp = Math.min(nextTemp, remaining);
    nextTemp -= absorbedByTemp;
    remaining -= absorbedByTemp;
  }
  return {
    hp: clamp(hp - remaining, 0, HP_MAX),
    tempHp: nextTemp,
    absorbedByTemp,
    toHp: remaining,
  };
}

function DamageAdjuster({
  sheet,
  setSheet,
}: {
  sheet: Sheet;
  setSheet: (next: Sheet | ((prev: Sheet) => Sheet)) => void;
}) {
  const [ui, setUi] = usePersistentState<DamageUi>(
    "gary-grapplesauce-combat:damage-ui",
    DEFAULT_DAMAGE_UI,
  );
  const [outcome, setOutcome] = useState<DamageOutcome | null>(null);

  const raw = Math.max(0, Number.parseInt(ui.amount || "0", 10) || 0);
  const resolved = resolveEffectiveness(
    ui.type,
    sheet.digDeepActive,
    ui.effectiveness,
  );
  const preview = modifyDamage(raw, resolved);

  function setAmount(next: string) {
    const cleaned = next.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    setUi((u) => ({ ...u, amount: cleaned === "" ? "0" : cleaned }));
  }

  function bump(delta: number) {
    setAmount(String(Math.max(0, raw + delta)));
  }

  function onAmountKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" || e.key === "Delete") return;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      bump(1);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      bump(-1);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      takeDamage();
      return;
    }
    if (e.key.length === 1 && !/\d/.test(e.key) && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
    }
  }

  function addIncrementPreset() {
    const n = Number.parseInt(ui.customIncrement || "0", 10);
    if (!n || n <= 0) return;
    setUi((u) => ({
      ...u,
      increments: [...new Set([...u.increments, n])].sort((a, b) => a - b),
    }));
  }

  function takeDamage() {
    const finalDamage = preview;
    const before = { hp: sheet.hp, tempHp: sheet.tempHp };
    const after = applyIncomingDamage(sheet.hp, sheet.tempHp, finalDamage);
    setSheet((s) => ({ ...s, hp: after.hp, tempHp: after.tempHp }));

    let title = "Damage applied";
    let tone: "info" | "warning" = "info";
    if (resolved === "immune") {
      title = "Immune — no damage";
      tone = "warning";
    } else if (resolved === "resistant") {
      title = "Resistant — half damage";
      tone = "info";
    } else if (resolved === "vulnerable") {
      title = "Vulnerable — double damage";
      tone = "warning";
    }

    const bits = [
      `${raw} ${ui.type}`,
      resolved !== "normal" ? `${resolved} → ${finalDamage}` : `${finalDamage} taken`,
    ];
    if (after.absorbedByTemp > 0) {
      bits.push(`${after.absorbedByTemp} absorbed by temp HP`);
    }
    if (after.toHp > 0) {
      bits.push(`${after.toHp} to HP (${before.hp} → ${after.hp})`);
    } else if (finalDamage > 0 && after.absorbedByTemp > 0) {
      bits.push(`HP unchanged at ${after.hp}`);
    }
    if (isBloodied(after.hp) && !isBloodied(before.hp)) {
      bits.push(`now bloodied (≤${BLOODIED_AT})`);
    }
    if (sheet.digDeepActive && isWeaponPhysical(ui.type) && ui.effectiveness === "auto") {
      bits.push("Dig Deep resistance applied");
    }

    setOutcome({ tone, title, detail: bits.join(" · ") });
  }

  function heal() {
    if (raw <= 0) {
      setOutcome({
        tone: "warning",
        title: "Nothing to heal",
        detail: "Enter an amount greater than 0.",
      });
      return;
    }
    const next = clamp(sheet.hp + raw, 0, HP_MAX);
    setSheet((s) => ({ ...s, hp: next }));
    setOutcome({
      tone: "info",
      title: "Healed",
      detail: `+${raw} HP (${sheet.hp} → ${next}). Damage type ignored for healing.`,
    });
  }

  const effHint =
    ui.effectiveness === "auto"
      ? sheet.digDeepActive && isWeaponPhysical(ui.type)
        ? "Dig Deep → resistant"
        : "Normal"
      : ui.effectiveness;

  return (
    <Stack gap={14}>
      <Text tone="secondary">
        Type the total, pick the type, then Take damage. Enter applies.
      </Text>

      <div className="hit-row">
        <label className="field hit-amount">
          <span className="field-label">Amount</span>
          <input
            className="field-input amount-input"
            inputMode="numeric"
            pattern="[0-9]*"
            value={ui.amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={onAmountKeyDown}
            aria-label="Damage or heal amount"
            autoFocus
          />
        </label>
        <label className="field hit-type">
          <span className="field-label">Type</span>
          <select
            className="field-input"
            value={ui.type}
            onChange={(e) =>
              setUi((u) => ({ ...u, type: e.target.value as DamageType }))
            }
          >
            {DAMAGE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Text tone="tertiary">
        {raw} → {preview} {ui.type} ({effHint})
        {sheet.tempHp > 0 ? ` · temp ${sheet.tempHp} first` : ""}
      </Text>

      <Row gap={8} wrap>
        <Button variant="primary" onClick={takeDamage}>
          Take damage
        </Button>
        <Button variant="secondary" onClick={heal}>
          Heal
        </Button>
      </Row>

      {outcome ? (
        <Callout tone={outcome.tone} title={outcome.title}>
          {outcome.detail}
        </Callout>
      ) : null}

      <details className="more-details">
        <summary>More damage options</summary>
        <Stack gap={12}>
          <label className="field">
            <span className="field-label">Override vs Gary</span>
            <select
              className="field-input"
              value={ui.effectiveness}
              onChange={(e) =>
                setUi((u) => ({
                  ...u,
                  effectiveness: e.target.value as Effectiveness,
                }))
              }
            >
              <option value="auto">Auto (Dig Deep if B/P/S)</option>
              <option value="normal">Normal</option>
              <option value="resistant">Resistant (½)</option>
              <option value="immune">Immune (0)</option>
              <option value="vulnerable">Vulnerable (×2)</option>
            </select>
          </label>

          <Row gap={8} wrap>
            {ui.increments.map((n) => (
              <Button key={n} variant="secondary" onClick={() => bump(n)}>
                +{n}
              </Button>
            ))}
            {ui.increments.map((n) => (
              <Button key={`m${n}`} variant="ghost" onClick={() => bump(-n)}>
                −{n}
              </Button>
            ))}
          </Row>

          <Row gap={8} wrap align="center">
            <input
              className="field-input step-input"
              inputMode="numeric"
              value={ui.customIncrement}
              onChange={(e) =>
                setUi((u) => ({
                  ...u,
                  customIncrement: e.target.value.replace(/\D/g, ""),
                }))
              }
              aria-label="Custom increment value"
            />
            <Button
              variant="ghost"
              onClick={() =>
                bump(Number.parseInt(ui.customIncrement || "0", 10) || 0)
              }
            >
              +step
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                bump(-(Number.parseInt(ui.customIncrement || "0", 10) || 0))
              }
            >
              −step
            </Button>
            <Button variant="ghost" onClick={addIncrementPreset}>
              Save step
            </Button>
          </Row>

          <Row gap={8} wrap>
            <Text tone="secondary">Temp HP: {sheet.tempHp}</Text>
            <Button
              variant="ghost"
              onClick={() =>
                setSheet((s) => ({ ...s, tempHp: s.tempHp + raw }))
              }
            >
              Add amount as temp
            </Button>
            <Button
              variant="ghost"
              disabled={sheet.tempHp <= 0}
              onClick={() => setSheet((s) => ({ ...s, tempHp: 0 }))}
            >
              Clear temp
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                setSheet((s) => ({ ...s, hp: HP_MAX, tempHp: 0 }))
              }
            >
              Full HP
            </Button>
          </Row>
        </Stack>
      </details>
    </Stack>
  );
}

function StatusBar({
  sheet,
  setSheet,
}: {
  sheet: Sheet;
  setSheet: (next: Sheet | ((prev: Sheet) => Sheet)) => void;
}) {
  return (
    <Card>
      <CardBody>
        <div className="status-bar">
          <div className="status-hp">
            <div className="status-hp-value">
              {sheet.hp}
              {sheet.tempHp > 0 ? (
                <span className="status-temp">+{sheet.tempHp}</span>
              ) : null}
            </div>
            <div className="status-hp-label">/ {HP_MAX} HP</div>
            <div
              className="hp-bar"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={HP_MAX}
              aria-valuenow={sheet.hp}
              aria-label="Hit points"
            >
              <div
                className="hp-bar-fill"
                style={{ width: `${Math.round((sheet.hp / HP_MAX) * 100)}%` }}
              />
            </div>
          </div>
          <div className="status-moxie">
            <div className="field-label">Moxie</div>
            <Row gap={6} wrap>
              {Array.from({ length: MOXIE_MAX }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Set Moxie to ${i + 1}`}
                  className={`dot${i < sheet.moxie ? " filled" : ""}`}
                  onClick={() =>
                    setSheet((s) => ({ ...s, moxie: i + 1 }))
                  }
                />
              ))}
            </Row>
            <Text tone="tertiary">
              {sheet.moxie}/{MOXIE_MAX}
              {sheet.moxie === 0 ? " · spends locked" : ""}
            </Text>
          </div>
        </div>
        <Row gap={8} wrap style={{ marginTop: 12 }}>
          {isBloodied(sheet.hp) ? <Pill active>Bloodied</Pill> : null}
          {sheet.digDeepActive ? <Pill active>Dig Deep</Pill> : null}
          {(sheet.exhaustion ?? 0) > 0 ? (
            <Pill active>Exhaustion {sheet.exhaustion}</Pill>
          ) : null}
          {activeConditions(sheet).map((c) => (
            <Pill key={c.id} active>
              {c.label}
            </Pill>
          ))}
          {sheet.bloodiedUnbowed ? <Pill>Bloodied ready</Pill> : null}
          {sheet.swagger ? <Pill>Swagger ready</Pill> : null}
          {sheet.digDeep ? <Pill>Dig Deep ready</Pill> : null}
          <Spacer />
          <Text tone="tertiary">Saved here</Text>
        </Row>
      </CardBody>
    </Card>
  );
}

function ConditionsPanel({
  sheet,
  setSheet,
}: {
  sheet: Sheet;
  setSheet: (next: Sheet | ((prev: Sheet) => Sheet)) => void;
}) {
  const conditions = sheet.conditions ?? emptyConditions();
  const exhaustion = sheet.exhaustion ?? 0;

  function toggle(id: ConditionId) {
    setSheet((s) => {
      const next = normalizeSheet(s);
      return {
        ...next,
        conditions: {
          ...next.conditions,
          [id]: !next.conditions[id],
        },
      };
    });
  }

  function clearConditions() {
    setSheet((s) => ({
      ...normalizeSheet(s),
      conditions: emptyConditions(),
      exhaustion: 0,
    }));
  }

  return (
    <Stack gap={14}>
      <Text tone="secondary">
        Tap what currently applies. Active ones also show on the status bar.
      </Text>

      <label className="field">
        <span className="field-label">Exhaustion</span>
        <Row gap={8} wrap>
          {Array.from({ length: 7 }, (_, level) => (
            <Button
              key={level}
              variant={exhaustion === level ? "primary" : "secondary"}
              onClick={() =>
                setSheet((s) => ({ ...normalizeSheet(s), exhaustion: level }))
              }
            >
              {level === 0 ? "None" : String(level)}
            </Button>
          ))}
        </Row>
      </label>

      <div className="condition-grid">
        {CONDITION_DEFS.map((c) => {
          const on = Boolean(conditions[c.id]);
          return (
            <button
              key={c.id}
              type="button"
              className={`condition-chip${on ? " on" : ""}`}
              aria-pressed={on}
              onClick={() => toggle(c.id)}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <Row gap={8} wrap>
        <Button
          variant="ghost"
          disabled={activeConditions(sheet).length === 0 && exhaustion === 0}
          onClick={clearConditions}
        >
          Clear all conditions
        </Button>
      </Row>
    </Stack>
  );
}

function RestPanel({
  sheet,
  setSheet,
}: {
  sheet: Sheet;
  setSheet: (next: Sheet | ((prev: Sheet) => Sheet)) => void;
}) {
  function patch(partial: Partial<Sheet>) {
    setSheet((s) => ({ ...s, ...partial }));
  }

  return (
    <Stack gap={14}>
      <Text tone="secondary">
        Toggle what’s still available, or take a rest to reset.
      </Text>
      <div className="resource-list">
        <label className="resource-row">
          <input
            type="checkbox"
            checked={sheet.bloodiedUnbowed}
            onChange={(e) => patch({ bloodiedUnbowed: e.target.checked })}
          />
          <span>
            Bloodied But Unbowed{" "}
            <span className="tertiary">1 / short rest</span>
          </span>
        </label>
        <label className="resource-row">
          <input
            type="checkbox"
            checked={sheet.swagger}
            onChange={(e) => patch({ swagger: e.target.checked })}
          />
          <span>
            Swagger Streak <span className="tertiary">1 / short rest</span>
          </span>
        </label>
        <label className="resource-row">
          <input
            type="checkbox"
            checked={sheet.digDeep}
            onChange={(e) =>
              patch({
                digDeep: e.target.checked,
                digDeepActive: e.target.checked ? sheet.digDeepActive : false,
              })
            }
          />
          <span>
            Dig Deep <span className="tertiary">1 / long rest</span>
          </span>
        </label>
        <label className="resource-row">
          <input
            type="checkbox"
            checked={sheet.digDeepActive}
            disabled={!sheet.digDeep && !sheet.digDeepActive}
            onChange={(e) => patch({ digDeepActive: e.target.checked })}
          />
          <span>
            Dig Deep active <span className="tertiary">resist B/P/S</span>
          </span>
        </label>
      </div>
      <Row gap={8} wrap>
        <Button
          variant="secondary"
          onClick={() =>
            setSheet((s) => ({
              ...normalizeSheet(s),
              moxie: MOXIE_MAX,
              bloodiedUnbowed: true,
              swagger: true,
              digDeepActive: false,
              tempHp: 0,
            }))
          }
        >
          Short rest
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            setSheet((s) => ({
              ...DEFAULT_SHEET,
              exhaustion: Math.max(0, (normalizeSheet(s).exhaustion || 0) - 1),
            }))
          }
        >
          Long rest
        </Button>
      </Row>
      <Text tone="tertiary">
        Short restores Moxie, Bloodied, Swagger. Long restores HP/uses, clears
        conditions, and reduces Exhaustion by 1.
      </Text>
    </Stack>
  );
}

type MainTab = "play" | "hit" | "conds" | "rest";

export function GaryCombatTool() {
  const [phase, setPhase] = useState<Phase>("timing");
  const [timing, setTiming] = useState<Timing | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [staticPlan, setStaticPlan] = useState<Plan | null>(null);
  const [sheetRaw, setSheetRaw] = usePersistentState<Sheet>(
    "gary-grapplesauce-combat:sheet",
    DEFAULT_SHEET,
  );
  const sheet = normalizeSheet(sheetRaw);
  const setSheet: typeof setSheetRaw = (next) => {
    if (typeof next === "function") {
      setSheetRaw((prev) => normalizeSheet(next(normalizeSheet(prev))));
    } else {
      setSheetRaw(normalizeSheet(next));
    }
  };
  const [tab, setTab] = usePersistentState<MainTab>(
    "gary-grapplesauce-combat:tab",
    "play",
  );
  const [spentApplied, setSpentApplied] = useState(false);

  // Migrate old moxie-only key once
  useEffect(() => {
    try {
      const legacy = localStorage.getItem(
        "table-tools:gary-grapplesauce-combat:moxie",
      );
      const hasSheet = localStorage.getItem(
        "table-tools:gary-grapplesauce-combat:sheet",
      );
      if (legacy != null && hasSheet == null) {
        const moxie = clamp(JSON.parse(legacy) as number, 0, MOXIE_MAX);
        setSheet((s) => ({ ...s, moxie }));
        localStorage.removeItem("table-tools:gary-grapplesauce-combat:moxie");
      }
    } catch {
      // ignore
    }
  }, [setSheet]);

  const availableGoals = GOAL_OPTIONS.filter((g) => g.cost <= sheet.moxie);
  const hiddenGoals = GOAL_OPTIONS.filter((g) => g.cost > sheet.moxie);

  const liveGoalPlan = useMemo(() => {
    if (!selectedGoal) return null;
    const option = GOAL_OPTIONS.find((g) => g.id === selectedGoal);
    if (!option || option.cost > sheet.moxie) return null;
    return planFor(selectedGoal, sheet);
  }, [selectedGoal, sheet]);

  const plan = selectedGoal ? liveGoalPlan : staticPlan;

  useEffect(() => {
    if (!selectedGoal || phase !== "result") return;
    const option = GOAL_OPTIONS.find((g) => g.id === selectedGoal);
    if (!option || option.cost > sheet.moxie) {
      setSelectedGoal(null);
      setSpentApplied(false);
      setPhase("goal");
    }
  }, [sheet.moxie, selectedGoal, phase]);

  useEffect(() => {
    setSpentApplied(false);
  }, [liveGoalPlan?.title, liveGoalPlan?.costLabel, staticPlan?.title]);

  function resetDecision() {
    setPhase("timing");
    setTiming(null);
    setSelectedGoal(null);
    setStaticPlan(null);
    setSpentApplied(false);
  }

  function pickTiming(next: Timing) {
    setTiming(next);
    setSelectedGoal(null);
    setStaticPlan(null);
    setSpentApplied(false);
    if (next === "check-fail") {
      setStaticPlan(checkFailPlan(sheet.swagger));
      setPhase("result");
      return;
    }
    if (next === "reaction") {
      setPhase("reaction");
      return;
    }
    setPhase("goal");
  }

  function pickReaction(kind: ReactionKind) {
    setSelectedGoal(null);
    setStaticPlan(reactionPlan(kind));
    setSpentApplied(false);
    setPhase("result");
  }

  function pickGoal(goal: Goal) {
    const option = GOAL_OPTIONS.find((g) => g.id === goal);
    if (!option || option.cost > sheet.moxie) return;
    setStaticPlan(null);
    setSelectedGoal(goal);
    setSpentApplied(false);
    setPhase("result");
  }

  function applyPlan() {
    if (!plan || spentApplied || !plan.apply || plan.apply === "none") return;

    setSheet((s) => {
      switch (plan.apply) {
        case "moxie":
          return {
            ...s,
            moxie: clamp(s.moxie - plan.cost, 0, MOXIE_MAX),
          };
        case "bloodied-unbowed":
          return {
            ...s,
            moxie: MOXIE_MAX,
            bloodiedUnbowed: false,
            tempHp: Math.max(s.tempHp, 36),
          };
        case "dig-deep":
          return {
            ...s,
            digDeep: false,
            digDeepActive: true,
          };
        case "swagger":
          return { ...s, swagger: false };
        default:
          return s;
      }
    });
    setSpentApplied(true);
  }

  function applyLabel(p: Plan): string | null {
    if (!p.apply || p.apply === "none") return null;
    if (spentApplied) {
      switch (p.apply) {
        case "moxie":
          return `Spent ${p.cost} Moxie`;
        case "bloodied-unbowed":
          return "Applied — Moxie full + 36 temp";
        case "dig-deep":
          return "Dig Deep used";
        case "swagger":
          return "Swagger used";
        default:
          return "Applied";
      }
    }
    switch (p.apply) {
      case "moxie":
        return `Spend ${p.cost} Moxie`;
      case "bloodied-unbowed":
        return "Apply Bloodied But Unbowed";
      case "dig-deep":
        return "Use Dig Deep";
      case "swagger":
        return "Use Swagger Streak";
      default:
        return null;
    }
  }

  const canBloodiedReaction =
    sheet.bloodiedUnbowed && isBloodied(sheet.hp);
  const bloodiedBlockedReason = !sheet.bloodiedUnbowed
    ? "Already used this short rest"
    : !isBloodied(sheet.hp)
      ? `Not bloodied (need HP ≤ ${BLOODIED_AT})`
      : null;

  return (
    <Stack gap={16}>
      <Stack gap={4}>
        <h1>Gary Grapplesauce</h1>
        <Text tone="secondary">
          {CHEAT.attack} · AC {CHEAT.ac} · Athletics {CHEAT.athletics}
        </Text>
      </Stack>

      <StatusBar sheet={sheet} setSheet={setSheet} />

      <div className="tab-bar" role="tablist" aria-label="Main mode">
        {(
          [
            ["play", "Play"],
            ["hit", "Hit"],
            ["conds", "Conds"],
            ["rest", "Rest"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`tab-btn${tab === id ? " active" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "play" ? (
        <Stack gap={12}>
          {phase === "timing" && (
            <Card>
              <CardHeader>What just happened?</CardHeader>
              <CardBody>
                <Stack gap={12}>
                  <Row gap={8} wrap>
                    <Button variant="primary" onClick={() => pickTiming("turn")}>
                      My turn
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => pickTiming("reaction")}
                    >
                      Reaction
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => pickTiming("check-fail")}
                    >
                      Failed check
                    </Button>
                  </Row>
                </Stack>
              </CardBody>
            </Card>
          )}

          {phase === "reaction" && (
            <Card>
              <CardHeader>Reaction</CardHeader>
              <CardBody>
                <Stack gap={12}>
                  <Row gap={8} wrap>
                    <Button
                      variant="primary"
                      disabled={!canBloodiedReaction}
                      onClick={() => pickReaction("bloodied")}
                    >
                      Bloodied + damage
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => pickReaction("mage-cast")}
                    >
                      Spell within 5 ft
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => pickReaction("opportunity")}
                    >
                      Left my reach
                    </Button>
                    <Button variant="ghost" onClick={() => pickReaction("other")}>
                      Hold reaction
                    </Button>
                  </Row>
                  {bloodiedBlockedReason ? (
                    <Text tone="tertiary">
                      Bloodied locked: {bloodiedBlockedReason}
                    </Text>
                  ) : null}
                  <Button variant="ghost" onClick={resetDecision}>
                    Back
                  </Button>
                </Stack>
              </CardBody>
            </Card>
          )}

          {phase === "goal" && (
            <Card>
              <CardHeader>This turn</CardHeader>
              <CardBody>
                <Stack gap={12}>
                  <Row gap={8} wrap>
                    {availableGoals.map((g) => (
                      <Button
                        key={g.id}
                        variant={g.variant}
                        onClick={() => pickGoal(g.id)}
                      >
                        {g.cost > 0 ? `${g.label} · ${g.cost}` : g.label}
                      </Button>
                    ))}
                  </Row>
                  {hiddenGoals.length > 0 ? (
                    <Text tone="tertiary">
                      Need more Moxie:{" "}
                      {hiddenGoals.map((g) => g.label).join(", ")}
                    </Text>
                  ) : null}
                  <Button variant="ghost" onClick={resetDecision}>
                    Back
                  </Button>
                </Stack>
              </CardBody>
            </Card>
          )}

          {phase === "result" && plan && (
            <Card>
              <CardHeader trailing={<Pill>{plan.costLabel}</Pill>}>
                {plan.title}
              </CardHeader>
              <CardBody>
                <Stack gap={14}>
                  <Stack gap={4}>
                    <h3>Action</h3>
                    <Text>{plan.action}</Text>
                  </Stack>
                  <Divider />
                  <Stack gap={4}>
                    <h3>Bonus Action</h3>
                    <Text>{plan.bonus}</Text>
                  </Stack>
                  {plan.reaction ? (
                    <>
                      <Divider />
                      <Stack gap={4}>
                        <h3>Reaction</h3>
                        <Text>{plan.reaction}</Text>
                      </Stack>
                    </>
                  ) : null}
                  <Text tone="secondary">{plan.gym}</Text>
                  <Row gap={8} wrap>
                    {applyLabel(plan) ? (
                      <Button
                        variant="primary"
                        disabled={
                          spentApplied ||
                          (plan.apply === "moxie" && sheet.moxie < plan.cost)
                        }
                        onClick={applyPlan}
                      >
                        {applyLabel(plan)}
                      </Button>
                    ) : null}
                    {selectedGoal === "survive" &&
                    sheet.digDeep &&
                    plan.apply === "moxie" ? (
                      <Button
                        variant="secondary"
                        disabled={spentApplied}
                        onClick={() => {
                          setSheet((s) => ({
                            ...s,
                            digDeep: false,
                            digDeepActive: true,
                          }));
                        }}
                      >
                        Also Dig Deep
                      </Button>
                    ) : null}
                    <Button variant="secondary" onClick={resetDecision}>
                      New decision
                    </Button>
                    {timing === "turn" ? (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setSelectedGoal(null);
                          setStaticPlan(null);
                          setSpentApplied(false);
                          setPhase("goal");
                        }}
                      >
                        Change goal
                      </Button>
                    ) : null}
                  </Row>
                </Stack>
              </CardBody>
            </Card>
          )}

          <details className="more-details">
            <summary>Priority cheat sheet</summary>
            <Stack gap={8}>
              {[
                "1. Bloodied But Unbowed if eligible.",
                "2. Mage Slayer if they cast within 5 ft.",
                "3. Live? Brace Up or Dig Deep.",
                "4. Move? Stick and Move.",
                "5. Else: Attack → Heavy Hitter → free punch.",
                "6. Lockdown: Stop and Drop → Compression Lock.",
                "7. Burst with One-Two when Moxie allows.",
              ].map((line) => (
                <div key={line} className="cheat-line">
                  <Text>{line}</Text>
                </div>
              ))}
            </Stack>
          </details>
        </Stack>
      ) : null}

      {tab === "hit" ? (
        <Card>
          <CardHeader>I took a hit</CardHeader>
          <CardBody>
            <DamageAdjuster sheet={sheet} setSheet={setSheet} />
          </CardBody>
        </Card>
      ) : null}

      {tab === "conds" ? (
        <Card>
          <CardHeader>Conditions</CardHeader>
          <CardBody>
            <ConditionsPanel sheet={sheet} setSheet={setSheet} />
          </CardBody>
        </Card>
      ) : null}

      {tab === "rest" ? (
        <Card>
          <CardHeader>Rests & limited uses</CardHeader>
          <CardBody>
            <RestPanel sheet={sheet} setSheet={setSheet} />
          </CardBody>
        </Card>
      ) : null}
    </Stack>
  );
}
