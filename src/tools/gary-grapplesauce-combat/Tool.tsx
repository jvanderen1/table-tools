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
  refill?: boolean;
};

const MOXIE_MAX = 5;

const CHEAT = {
  attack: "+9 / 1d10+5 bludgeoning",
  ac: "18",
  hp: "103",
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

function planFor(goal: Goal, moxie: number): Plan {
  const canSpend = moxie >= 1;

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
      };
    case "survive":
      return canSpend
        ? {
            title: "Stay standing",
            action:
              "Attack only if safe. Prefer holding position or Disengaging later.",
            bonus:
              "Brace Up (1 Moxie): temp HP = 1d10 + 12. Dig Deep (1/long rest) if the fight is long.",
            reaction:
              "If bloodied and you take damage: Bloodied But Unbowed — regain all Moxie + 36 temp HP (1/short rest).",
            cost: 1,
            costLabel: "1",
            why: "Temp HP now. Dig Deep is free but once per long rest.",
            gym: "Flex. Leg Day.",
          }
        : {
            title: "Stay standing (no Moxie)",
            action:
              "Attack only if safe. Hold position behind allies if possible.",
            bonus:
              "Dig Deep (1/long rest): resistance to B/P/S for 10 minutes. Brace Up locked until you have 1 Moxie.",
            reaction:
              "If bloodied and you take damage: Bloodied But Unbowed — regain all Moxie + 36 temp HP (1/short rest).",
            cost: 0,
            costLabel: "0 (+ Dig Deep)",
            why: "No Brace Up without Moxie. Dig Deep or wait for Bloodied But Unbowed.",
            gym: "Leg Day.",
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
        costLabel: "refill to 5",
        why: "Only when you take damage while bloodied. Biggest swing button in the kit.",
        gym: "Not done. Spot me.",
        refill: true,
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
      };
  }
}

function checkFailPlan(): Plan {
  return {
    title: "Swagger Streak",
    action: "No Action — after you fail a Str, Dex, Con, or Cha check.",
    bonus: "—",
    reaction: "Add 1d10 to the failed check (1/short rest).",
    cost: 0,
    costLabel: "0",
    why: "Use on Athletics grapples/shoves or key Str/Dex/Con/Cha checks you can't afford to miss.",
    gym: "One more rep.",
  };
}

function MoxieTracker({
  moxie,
  setMoxie,
}: {
  moxie: number;
  setMoxie: (n: number) => void;
}) {
  const locked = [
    { name: "One-Two Punch", cost: 1 },
    { name: "Brace Up", cost: 1 },
    { name: "Stick and Move", cost: 1 },
    { name: "Inescapable", cost: 1 },
  ].filter((o) => o.cost > moxie);

  return (
    <Card>
      <CardHeader trailing={<Pill>{moxie} / {MOXIE_MAX}</Pill>}>
        Moxie tracker
      </CardHeader>
      <CardBody>
        <Stack gap={12}>
          <Row gap={8} wrap>
            <Button
              variant="secondary"
              disabled={moxie <= 0}
              onClick={() => setMoxie(Math.max(0, moxie - 1))}
            >
              −1
            </Button>
            <Row gap={6} wrap>
              {Array.from({ length: MOXIE_MAX }, (_, i) => {
                const filled = i < moxie;
                return (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Set Moxie to ${i + 1}`}
                    className={`dot${filled ? " filled" : ""}`}
                    onClick={() => setMoxie(i + 1)}
                  />
                );
              })}
            </Row>
            <Button
              variant="secondary"
              disabled={moxie >= MOXIE_MAX}
              onClick={() => setMoxie(Math.min(MOXIE_MAX, moxie + 1))}
            >
              +1
            </Button>
            <Button variant="ghost" onClick={() => setMoxie(MOXIE_MAX)}>
              Full
            </Button>
            <Button
              variant="ghost"
              disabled={moxie <= 0}
              onClick={() => setMoxie(0)}
            >
              Empty
            </Button>
          </Row>
          <Text tone="secondary">
            {moxie} of {MOXIE_MAX} remaining. Options that cost more than this
            are hidden.
          </Text>
          {locked.length > 0 ? (
            <Text tone="tertiary">
              Locked: {locked.map((o) => `${o.name} (${o.cost})`).join(" · ")}
            </Text>
          ) : (
            <Text tone="tertiary">All Moxie spends available.</Text>
          )}
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
  const [moxie, setMoxie] = usePersistentState<number>(
    "gary-grapplesauce-combat:moxie",
    MOXIE_MAX,
  );
  const [spentApplied, setSpentApplied] = useState(false);

  const availableGoals = GOAL_OPTIONS.filter((g) => g.cost <= moxie);
  const hiddenGoals = GOAL_OPTIONS.filter((g) => g.cost > moxie);

  const liveGoalPlan = useMemo(() => {
    if (!selectedGoal) return null;
    const option = GOAL_OPTIONS.find((g) => g.id === selectedGoal);
    if (!option || option.cost > moxie) return null;
    return planFor(selectedGoal, moxie);
  }, [selectedGoal, moxie]);

  const plan = selectedGoal ? liveGoalPlan : staticPlan;

  useEffect(() => {
    if (!selectedGoal || phase !== "result") return;
    const option = GOAL_OPTIONS.find((g) => g.id === selectedGoal);
    if (!option || option.cost > moxie) {
      setSelectedGoal(null);
      setSpentApplied(false);
      setPhase("goal");
    }
  }, [moxie, selectedGoal, phase]);

  useEffect(() => {
    setSpentApplied(false);
  }, [liveGoalPlan?.title, liveGoalPlan?.costLabel]);

  function clampMoxie(n: number) {
    return Math.max(0, Math.min(MOXIE_MAX, n));
  }

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
      setStaticPlan(checkFailPlan());
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
    if (!option || option.cost > moxie) return;
    setStaticPlan(null);
    setSelectedGoal(goal);
    setSpentApplied(false);
    setPhase("result");
  }

  function applyPlanMoxie() {
    if (!plan || spentApplied) return;
    if (plan.refill) {
      setMoxie(MOXIE_MAX);
      setSpentApplied(true);
      return;
    }
    if (plan.cost > 0) {
      setMoxie(clampMoxie(moxie - plan.cost));
      setSpentApplied(true);
    }
  }

  return (
    <Stack gap={20}>
      <Stack gap={6}>
        <h1>Gary Grapplesauce — combat tree</h1>
        <Text tone="secondary">
          Pugilist 9 · Squared Circle · live sheet numbers. Track Moxie, then
          answer one question at a time.
        </Text>
      </Stack>

      <Grid columns={3}>
        <Stat value={CHEAT.attack} label="Unarmed" />
        <Stat value={CHEAT.ac} label="AC" />
        <Stat value={CHEAT.hp} label="HP" />
      </Grid>

      <MoxieTracker moxie={moxie} setMoxie={(n) => setMoxie(clampMoxie(n))} />

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
          <CardHeader trailing={<Pill>Moxie cost: {plan.costLabel}</Pill>}>
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
                {plan.refill ? (
                  <Button
                    variant="primary"
                    disabled={spentApplied}
                    onClick={applyPlanMoxie}
                  >
                    {spentApplied ? "Moxie refilled" : "Apply refill to 5"}
                  </Button>
                ) : plan.cost > 0 ? (
                  <Button
                    variant="primary"
                    disabled={spentApplied || moxie < plan.cost}
                    onClick={applyPlanMoxie}
                  >
                    {spentApplied
                      ? `Spent ${plan.cost}`
                      : `Spend ${plan.cost} Moxie`}
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
