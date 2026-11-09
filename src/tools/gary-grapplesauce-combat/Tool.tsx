import { useEffect, useMemo, useState } from "react";
import { usePersistentState } from "../../lib/usePersistentState";
import {
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Grid,
  Pill,
  Row,
  Spacer,
  Stack,
  Stat,
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

type Sheet = {
  moxie: number;
  hp: number;
  tempHp: number;
  /** Remaining uses — true = still available */
  digDeep: boolean;
  digDeepActive: boolean;
  bloodiedUnbowed: boolean;
  swagger: boolean;
};

const MOXIE_MAX = 5;
const HP_MAX = 103;
const BLOODIED_AT = Math.floor(HP_MAX / 2); // ≤ 51

const DEFAULT_SHEET: Sheet = {
  moxie: MOXIE_MAX,
  hp: HP_MAX,
  tempHp: 0,
  digDeep: true,
  digDeepActive: false,
  bloodiedUnbowed: true,
  swagger: true,
};

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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function ResourcePanel({
  sheet,
  setSheet,
}: {
  sheet: Sheet;
  setSheet: (next: Sheet | ((prev: Sheet) => Sheet)) => void;
}) {
  const bloodied = isBloodied(sheet.hp);
  const hpPct = Math.round((sheet.hp / HP_MAX) * 100);

  function patch(partial: Partial<Sheet>) {
    setSheet((s) => ({ ...s, ...partial }));
  }

  function shortRest() {
    setSheet((s) => ({
      ...s,
      moxie: MOXIE_MAX,
      bloodiedUnbowed: true,
      swagger: true,
      digDeepActive: false,
      tempHp: 0,
    }));
  }

  function longRest() {
    setSheet({ ...DEFAULT_SHEET });
  }

  const lockedMoxie = [
    { name: "One-Two Punch", cost: 1 },
    { name: "Brace Up", cost: 1 },
    { name: "Stick and Move", cost: 1 },
    { name: "Inescapable", cost: 1 },
  ].filter((o) => o.cost > sheet.moxie);

  return (
    <Card>
      <CardHeader
        trailing={
          <Pill>
            {sheet.hp}
            {sheet.tempHp > 0 ? `+${sheet.tempHp}` : ""} / {HP_MAX}
          </Pill>
        }
      >
        Session tracker
      </CardHeader>
      <CardBody>
        <Stack gap={16}>
          <Stack gap={8}>
            <Row gap={8} wrap>
              <Text>HP</Text>
              {bloodied ? <Pill active>Bloodied</Pill> : null}
              {sheet.digDeepActive ? <Pill active>Dig Deep on</Pill> : null}
              <Spacer />
              <Text tone="tertiary">Saved in this browser</Text>
            </Row>
            <div
              className="hp-bar"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={HP_MAX}
              aria-valuenow={sheet.hp}
              aria-label="Hit points"
            >
              <div className="hp-bar-fill" style={{ width: `${hpPct}%` }} />
            </div>
            <Row gap={8} wrap>
              <Button
                variant="secondary"
                onClick={() => patch({ hp: clamp(sheet.hp - 5, 0, HP_MAX) })}
              >
                −5
              </Button>
              <Button
                variant="secondary"
                onClick={() => patch({ hp: clamp(sheet.hp - 1, 0, HP_MAX) })}
              >
                −1
              </Button>
              <Button
                variant="secondary"
                onClick={() => patch({ hp: clamp(sheet.hp + 1, 0, HP_MAX) })}
              >
                +1
              </Button>
              <Button
                variant="secondary"
                onClick={() => patch({ hp: clamp(sheet.hp + 5, 0, HP_MAX) })}
              >
                +5
              </Button>
              <Button
                variant="ghost"
                onClick={() => patch({ hp: HP_MAX, tempHp: 0 })}
              >
                Full HP
              </Button>
            </Row>
            <Row gap={8} wrap>
              <Text tone="secondary">
                Temp HP: {sheet.tempHp}
              </Text>
              <Button
                variant="ghost"
                disabled={sheet.tempHp <= 0}
                onClick={() => patch({ tempHp: clamp(sheet.tempHp - 1, 0, 99) })}
              >
                Temp −1
              </Button>
              <Button
                variant="ghost"
                onClick={() => patch({ tempHp: sheet.tempHp + 1 })}
              >
                Temp +1
              </Button>
              <Button
                variant="ghost"
                disabled={sheet.tempHp <= 0}
                onClick={() => patch({ tempHp: 0 })}
              >
                Clear temp
              </Button>
            </Row>
          </Stack>

          <Divider />

          <Stack gap={8}>
            <Row gap={8} wrap>
              <Text>Moxie</Text>
              <Pill>
                {sheet.moxie} / {MOXIE_MAX}
              </Pill>
            </Row>
            <Row gap={8} wrap>
              <Button
                variant="secondary"
                disabled={sheet.moxie <= 0}
                onClick={() =>
                  patch({ moxie: clamp(sheet.moxie - 1, 0, MOXIE_MAX) })
                }
              >
                −1
              </Button>
              <Row gap={6} wrap>
                {Array.from({ length: MOXIE_MAX }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Set Moxie to ${i + 1}`}
                    className={`dot${i < sheet.moxie ? " filled" : ""}`}
                    onClick={() => patch({ moxie: i + 1 })}
                  />
                ))}
              </Row>
              <Button
                variant="secondary"
                disabled={sheet.moxie >= MOXIE_MAX}
                onClick={() =>
                  patch({ moxie: clamp(sheet.moxie + 1, 0, MOXIE_MAX) })
                }
              >
                +1
              </Button>
              <Button
                variant="ghost"
                onClick={() => patch({ moxie: MOXIE_MAX })}
              >
                Full
              </Button>
            </Row>
            {lockedMoxie.length > 0 ? (
              <Text tone="tertiary">
                Locked:{" "}
                {lockedMoxie.map((o) => `${o.name} (${o.cost})`).join(" · ")}
              </Text>
            ) : (
              <Text tone="tertiary">All Moxie spends available.</Text>
            )}
          </Stack>

          <Divider />

          <Stack gap={8}>
            <Text>Limited uses</Text>
            <div className="resource-list">
              <label className="resource-row">
                <input
                  type="checkbox"
                  checked={sheet.bloodiedUnbowed}
                  onChange={(e) =>
                    patch({ bloodiedUnbowed: e.target.checked })
                  }
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
                  Swagger Streak{" "}
                  <span className="tertiary">1 / short rest</span>
                </span>
              </label>
              <label className="resource-row">
                <input
                  type="checkbox"
                  checked={sheet.digDeep}
                  onChange={(e) =>
                    patch({
                      digDeep: e.target.checked,
                      digDeepActive: e.target.checked
                        ? sheet.digDeepActive
                        : false,
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
                  Dig Deep active{" "}
                  <span className="tertiary">resist B/P/S ~10 min</span>
                </span>
              </label>
            </div>
          </Stack>

          <Row gap={8} wrap>
            <Button variant="secondary" onClick={shortRest}>
              Short rest
            </Button>
            <Button variant="secondary" onClick={longRest}>
              Long rest
            </Button>
            <Text tone="tertiary">
              Short: Moxie, Bloodied, Swagger. Long: everything + full HP.
            </Text>
          </Row>
        </Stack>
      </CardBody>
    </Card>
  );
}

export function GaryCombatTool() {
  const [phase, setPhase] = useState<Phase>("timing");
  const [timing, setTiming] = useState<Timing | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [staticPlan, setStaticPlan] = useState<Plan | null>(null);
  const [sheet, setSheet] = usePersistentState<Sheet>(
    "gary-grapplesauce-combat:sheet",
    DEFAULT_SHEET,
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
    <Stack gap={20}>
      <Stack gap={6}>
        <h1>Gary Grapplesauce — combat tree</h1>
        <Text tone="secondary">
          Pugilist 9 · Squared Circle. Track HP, Moxie, and once-per-rest uses —
          numbers stick in this browser.
        </Text>
      </Stack>

      <Grid columns={3}>
        <Stat value={CHEAT.attack} label="Unarmed" />
        <Stat value={CHEAT.ac} label="AC" />
        <Stat
          value={`${sheet.hp}${sheet.tempHp ? `+${sheet.tempHp}` : ""}`}
          label="HP now"
        />
      </Grid>

      <ResourcePanel sheet={sheet} setSheet={setSheet} />

      <Row gap={8} wrap>
        <Text tone="tertiary">Athletics {CHEAT.athletics}</Text>
        <Spacer />
        <Text tone="tertiary">{CHEAT.saves}</Text>
      </Row>

      {phase === "timing" && (
        <Card>
          <CardHeader>What just happened?</CardHeader>
          <CardBody>
            <Stack gap={12}>
              <Text>Pick the moment you need a decision for.</Text>
              <Row gap={8} wrap>
                <Button variant="primary" onClick={() => pickTiming("turn")}>
                  My turn
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => pickTiming("reaction")}
                >
                  Reaction window
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => pickTiming("check-fail")}
                >
                  Failed ability check
                </Button>
              </Row>
            </Stack>
          </CardBody>
        </Card>
      )}

      {phase === "reaction" && (
        <Card>
          <CardHeader>What triggered the Reaction?</CardHeader>
          <CardBody>
            <Stack gap={12}>
              <Row gap={8} wrap>
                <Button
                  variant="primary"
                  disabled={!canBloodiedReaction}
                  onClick={() => pickReaction("bloodied")}
                >
                  Bloodied + took damage
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => pickReaction("mage-cast")}
                >
                  Spell cast within 5 ft
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => pickReaction("opportunity")}
                >
                  Creature left my reach
                </Button>
                <Button variant="ghost" onClick={() => pickReaction("other")}>
                  None of these
                </Button>
              </Row>
              {bloodiedBlockedReason ? (
                <Text tone="tertiary">
                  Bloodied But Unbowed locked: {bloodiedBlockedReason}
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
          <CardHeader>What do you want this turn?</CardHeader>
          <CardBody>
            <Stack gap={12}>
              <Row gap={8} wrap>
                {availableGoals.map((g) => (
                  <Button
                    key={g.id}
                    variant={g.variant}
                    onClick={() => pickGoal(g.id)}
                  >
                    {g.cost > 0 ? `${g.label} · ${g.cost} Moxie` : g.label}
                  </Button>
                ))}
              </Row>
              {hiddenGoals.length > 0 ? (
                <Callout tone="warning" title="Hidden — not enough Moxie">
                  {hiddenGoals
                    .map((g) => `${g.label} (needs ${g.cost})`)
                    .join(" · ")}
                </Callout>
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
          <CardHeader trailing={<Pill>Cost: {plan.costLabel}</Pill>}>
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
              <Callout tone="info" title="Why">
                {plan.why}
              </Callout>
              <Text tone="secondary">Table line: {plan.gym}</Text>
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
                    Also use Dig Deep
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

      <Stack gap={10}>
        <h2>Priority cheat sheet</h2>
        <Text tone="secondary">
          When overwhelmed, run top to bottom before picking a fancy combo.
        </Text>
        <Grid columns={1}>
          {[
            "1. Reaction: Bloodied But Unbowed if eligible (refills Moxie).",
            "2. Reaction: Mage Slayer if a caster casts within 5 ft.",
            "3. Need to live? Brace Up (1) or Dig Deep before greed damage.",
            "4. Need to move? Stick and Move (1) beats Action Dash.",
            "5. Otherwise: Attack → Heavy Hitter → free Fisticuffs punch.",
            "6. Want lockdown? Stop and Drop, then Compression Lock next turns.",
            "7. Burst with One-Two (1) only when Moxie allows.",
          ].map((line) => (
            <div key={line} className="cheat-line">
              <Text>{line}</Text>
            </div>
          ))}
        </Grid>
      </Stack>
    </Stack>
  );
}
