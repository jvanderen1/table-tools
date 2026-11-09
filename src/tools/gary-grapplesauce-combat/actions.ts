/**
 * Everything Gary can do in a fight, from the live sheet
 * (ClericOfWisdom 173364108). Playbooks point at these ids.
 * Summaries are table shorthand, not the book text.
 */

export const ACTION_PARTS = ["action", "bonus", "reaction", "free"] as const;
export type ActionPart = (typeof ACTION_PARTS)[number];

export const PART_LABEL: Record<
  ActionPart,
  "Action" | "Bonus Action" | "Reaction" | "No action"
> = {
  action: "Action",
  bonus: "Bonus Action",
  reaction: "Reaction",
  free: "No action",
};

export type ActionApply =
  | "moxie"
  | "bloodied-unbowed"
  | "dig-deep"
  | "dig-deep-exhaustion"
  | "swagger"
  | "guarded-mind"
  | "down-but-not-out";

export type ActionDice = "attack" | "damage" | "brace" | "swagger";

export type GameAction = {
  id: string;
  name: string;
  part: ActionPart;
  summary: string;
  moxie: number;
  apply: ActionApply;
  dice?: ActionDice[];
  auto?: "brace" | "swagger";
  /** Only one action in a group can be spent from a playbook. */
  group?: "bonus" | "reaction";
  when?:
    | "dig-ready"
    | "dig-spent"
    | "unbowed-ready"
    | "swagger-ready"
    | "guarded-ready"
    | "down-ready";
};

export type CustomAction = {
  id: string;
  name: string;
  part: ActionPart;
  summary: string;
  moxie: number;
};

export const ACTIONS: GameAction[] = [
  {
    id: "attack",
    name: "Attack",
    part: "action",
    summary:
      "Two Unarmed Strikes. On a hit you can also Grapple or Shove (Heavy Hitter). Grappler: once a turn, damage and Grapple, Advantage against someone you are grappling, and no extra movement to drag a creature your size or smaller. A damage die that shows 1 is rerolled once. The damage can be bludgeoning or Force.",
    moxie: 0,
    apply: "moxie",
    dice: ["attack", "damage"],
  },
  {
    id: "haymaker",
    name: "Haymaker",
    part: "free",
    summary:
      "When you attack with an Unarmed Strike or Pugilist weapon, expend 1 Moxie. On a hit, the damage is maximum and you regain that Moxie. On a miss, the Moxie stays spent.",
    moxie: 1,
    apply: "moxie",
  },
  {
    id: "hard-knocks",
    name: "School of Hard Knocks",
    part: "free",
    summary:
      "Once a turn, when you hit with an Unarmed Strike or Pugilist weapon, add 1d12 of the same damage type. You can skip that damage to Endanger (the next attack that hits them deals maximum damage dice) or Provoke (Disadvantage on attacks against anyone but you until the end of your next turn).",
    moxie: 0,
    apply: "moxie",
  },
  {
    id: "push",
    name: "Tavern push",
    part: "free",
    summary:
      "Once a turn, when you hit with an Unarmed Strike, you can deal damage and also push the target 5 feet.",
    moxie: 0,
    apply: "moxie",
  },
  {
    id: "fisticuffs",
    name: "Fisticuffs",
    part: "bonus",
    summary:
      "While unarmed or wielding only Pugilist weapons, in light or no armor and no shield, you can make one Unarmed Strike as a Bonus Action.",
    moxie: 0,
    apply: "moxie",
    dice: ["attack", "damage"],
    group: "bonus",
  },
  {
    id: "one-two",
    name: "One-Two Punch",
    part: "bonus",
    summary:
      "Bonus Action. Expend 1 Moxie and make two Unarmed Strikes. The damage can be bludgeoning or Force.",
    moxie: 1,
    apply: "moxie",
    dice: ["attack", "damage"],
    group: "bonus",
  },
  {
    id: "stick-and-move",
    name: "Stick and Move",
    part: "bonus",
    summary:
      "Bonus Action. Expend 1 Moxie, make one Unarmed Strike, and take the Dash or Disengage action.",
    moxie: 1,
    apply: "moxie",
    dice: ["attack", "damage"],
    group: "bonus",
  },
  {
    id: "brace-up",
    name: "Brace Up",
    part: "bonus",
    summary:
      "Bonus Action. Expend 1 Moxie, roll your Fisticuffs die, and gain temporary hit points equal to the roll + 12. They vanish after 10 minutes.",
    moxie: 1,
    apply: "moxie",
    auto: "brace",
    group: "bonus",
  },
  {
    id: "dig-deep",
    name: "Dig Deep",
    part: "bonus",
    summary:
      "Bonus Action, once per long rest. For 10 minutes you have Resistance to bludgeoning, piercing, and slashing, and you ignore Exhaustion below 6.",
    moxie: 0,
    apply: "dig-deep",
    group: "bonus",
    when: "dig-ready",
  },
  {
    id: "dig-deep-again",
    name: "Dig Deep again",
    part: "free",
    summary:
      "No action. Gain 1 Exhaustion to restore your use of Dig Deep. You cannot do this if it would reach Exhaustion 6.",
    moxie: 0,
    apply: "dig-deep-exhaustion",
    when: "dig-spent",
  },
  {
    id: "bloodied",
    name: "Bloodied But Unbowed",
    part: "reaction",
    summary:
      "Reaction when you take damage: regain all expended Moxie. If you are bloodied, also gain 36 temporary hit points, which vanish at the end of a short rest. Once per short or long rest.",
    moxie: 0,
    apply: "bloodied-unbowed",
    group: "reaction",
    when: "unbowed-ready",
  },
  {
    id: "meat-shield",
    name: "Meat Shield",
    part: "reaction",
    summary:
      "A creature you are not grappling misses you. Spend 1 Moxie and they make that same attack against a creature you have grappled. Half cover while you hold someone is free and is not this button.",
    moxie: 1,
    apply: "moxie",
    group: "reaction",
  },
  {
    id: "mage-slayer",
    name: "Mage Slayer",
    part: "reaction",
    summary:
      "Reaction: a creature within 5 feet casts a spell with a spell slot, so you make an Unarmed Strike. Separately, whenever you damage a concentrating creature, that Concentration save has Disadvantage.",
    moxie: 0,
    apply: "moxie",
    dice: ["attack", "damage"],
    group: "reaction",
  },
  {
    id: "opportunity",
    name: "Opportunity attack",
    part: "reaction",
    summary:
      "Reaction when a creature you can see leaves your reach. One Unarmed Strike.",
    moxie: 0,
    apply: "moxie",
    dice: ["attack", "damage"],
    group: "reaction",
  },
  {
    id: "swagger",
    name: "Swagger Streak",
    part: "free",
    summary:
      "When you fail a Strength, Dexterity, Constitution, or Charisma check, expend 1 Moxie and add 1d10. If the check still fails, you regain that Moxie and cannot use this again until a short or long rest. If it succeeds, the Moxie stays spent.",
    moxie: 1,
    apply: "swagger",
    auto: "swagger",
    when: "swagger-ready",
  },
  {
    id: "guarded-mind",
    name: "Guarded Mind",
    part: "free",
    summary:
      "You failed an Intelligence, Wisdom, or Charisma save. Succeed instead. Once per short rest.",
    moxie: 0,
    apply: "guarded-mind",
    when: "guarded-ready",
  },
  {
    id: "stop-and-drop",
    name: "Stop and Drop",
    part: "free",
    summary:
      "When you hit with an Unarmed Strike and you do not use a mastery property on that attack, you can both Grapple and Shove.",
    moxie: 0,
    apply: "moxie",
  },
  {
    id: "inescapable",
    name: "Inescapable",
    part: "free",
    summary:
      "When a creature makes a save or ability check against your grapple or shove DC, expend 1 Moxie. That roll has Disadvantage.",
    moxie: 1,
    apply: "moxie",
  },
  {
    id: "compression-lock",
    name: "Compression Lock",
    part: "free",
    summary:
      "No action. At the start of your turn, if you have a creature grappled, you can deal 1d10 + 5 bludgeoning to each of them. The +5 is your Strength modifier, as printed on the sheet.",
    moxie: 0,
    apply: "moxie",
    dice: ["damage"],
  },
  {
    id: "down-but-not-out",
    name: "Down But Not Out",
    part: "free",
    summary:
      "Once per long rest, when you use Bloodied But Unbowed while bloodied. For 1 minute, your Unarmed Strikes and Pugilist weapons add 3 + your Exhaustion level. The 3 is your Constitution modifier, as printed on the sheet.",
    moxie: 0,
    apply: "down-but-not-out",
    when: "down-ready",
  },
  {
    id: "dodge",
    name: "Dodge",
    part: "action",
    summary:
      "Until the start of your next turn, attacks against you have Disadvantage and you have Advantage on Dexterity saves. You lose this if you are Incapacitated or your Speed is 0.",
    moxie: 0,
    apply: "moxie",
  },
  {
    id: "help",
    name: "Help",
    part: "action",
    summary:
      "Either distract a creature within 5 feet (the next attack against it has Advantage) or help an ally with an ability check.",
    moxie: 0,
    apply: "moxie",
  },
];

export function isCustomAction(id: string) {
  return id.startsWith("custom-");
}

export function actionAvailable(
  action: GameAction,
  sheet: {
    digDeep: boolean;
    bloodiedUnbowed: boolean;
    swagger: boolean;
    guardedMind: boolean;
    downButNotOut: boolean;
    exhaustion: number;
  },
) {
  switch (action.when) {
    case "dig-ready":
      return sheet.digDeep;
    case "dig-spent":
      return !sheet.digDeep && sheet.exhaustion < 5;
    case "unbowed-ready":
      return sheet.bloodiedUnbowed;
    case "swagger-ready":
      return sheet.swagger;
    case "guarded-ready":
      return sheet.guardedMind;
    case "down-ready":
      return sheet.downButNotOut;
    default:
      return true;
  }
}
