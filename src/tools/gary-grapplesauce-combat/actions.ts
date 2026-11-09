/**
 * Everything Gary can do in a fight, from the live sheet
 * (ClericOfWisdom 173364108). Playbooks point at these ids.
 * Summaries are table shorthand, not the book text.
 */

export const ACTION_PARTS = ["action", "bonus", "reaction", "free"] as const;
export type ActionPart = (typeof ACTION_PARTS)[number];

export const PART_LABEL: Record<ActionPart, "Action" | "Bonus Action" | "Reaction" | "No action"> = {
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
      "Two Unarmed Strikes (Extra Attack). On a hit: Heavy Hitter adds Grapple or Shove. Grappler can add Grapple once a turn, and you have Advantage on attacks against a creature you are grappling.",
    moxie: 0,
    apply: "moxie",
    dice: ["attack", "damage"],
  },
  {
    id: "haymaker",
    name: "Haymaker",
    part: "action",
    summary:
      "Spend 1 Moxie on an Unarmed Strike. On a hit, deal maximum damage and get the Moxie back. On a miss it is gone. Undo the spend if it misses.",
    moxie: 1,
    apply: "moxie",
  },
  {
    id: "hard-knocks",
    name: "School of Hard Knocks",
    part: "action",
    summary:
      "Once a turn, add 1d12 to an unarmed hit, or skip the damage to Endanger (next hit on them is max damage) or Provoke (they have Disadvantage attacking anyone but you).",
    moxie: 0,
    apply: "moxie",
    dice: ["damage"],
  },
  {
    id: "push",
    name: "Tavern push",
    part: "action",
    summary: "Once a turn, when an Unarmed Strike hits, you can also push the target 5 feet.",
    moxie: 0,
    apply: "moxie",
  },
  {
    id: "fisticuffs",
    name: "Fisticuffs",
    part: "bonus",
    summary: "One free Unarmed Strike. This is the bonus strike when you are not spending Moxie.",
    moxie: 0,
    apply: "moxie",
    dice: ["attack", "damage"],
    group: "bonus",
  },
  {
    id: "one-two",
    name: "One-Two Punch",
    part: "bonus",
    summary: "Two Unarmed Strikes.",
    moxie: 1,
    apply: "moxie",
    dice: ["attack", "damage"],
    group: "bonus",
  },
  {
    id: "stick-and-move",
    name: "Stick and Move",
    part: "bonus",
    summary: "One Unarmed Strike, then Dash or Disengage.",
    moxie: 1,
    apply: "moxie",
    dice: ["attack", "damage"],
    group: "bonus",
  },
  {
    id: "brace-up",
    name: "Brace Up",
    part: "bonus",
    summary: "Roll the Fisticuffs die and gain that plus 12 temporary hit points for about 10 minutes.",
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
      "For about 10 minutes, resist bludgeoning, piercing, and slashing, and ignore Exhaustion below 6. Once per long rest.",
    moxie: 0,
    apply: "dig-deep",
    group: "bonus",
    when: "dig-ready",
  },
  {
    id: "dig-deep-again",
    name: "Dig Deep again",
    part: "bonus",
    summary: "The free use is gone. Take 1 Exhaustion (never to 6) to turn Dig Deep back on.",
    moxie: 0,
    apply: "dig-deep-exhaustion",
    group: "bonus",
    when: "dig-spent",
  },
  {
    id: "bloodied",
    name: "Bloodied But Unbowed",
    part: "reaction",
    summary:
      "When you take damage: refill Moxie. If you are bloodied, also gain 36 temporary hit points. Once per short rest.",
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
      "A creature within 5 feet casts a spell with a spell slot: make an Unarmed Strike. Damage you deal also gives them Disadvantage on the Concentration save.",
    moxie: 0,
    apply: "moxie",
    dice: ["attack", "damage"],
    group: "reaction",
  },
  {
    id: "opportunity",
    name: "Opportunity attack",
    part: "reaction",
    summary: "They leave your reach. Unarmed Strike.",
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
      "You failed a Strength, Dexterity, Constitution, or Charisma check. Add 1d10. If it still fails, the Moxie comes back and this is spent until a short rest.",
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
    id: "inescapable",
    name: "Inescapable",
    part: "free",
    summary: "They roll to escape your grapple or shove. Spend 1 Moxie and that roll has Disadvantage.",
    moxie: 1,
    apply: "moxie",
  },
  {
    id: "compression-lock",
    name: "Compression Lock",
    part: "free",
    summary:
      "At the start of your turn, each creature you have grappled takes your unarmed damage. No action.",
    moxie: 0,
    apply: "moxie",
    dice: ["damage"],
  },
  {
    id: "down-but-not-out",
    name: "Down But Not Out",
    part: "free",
    summary:
      "When you use Bloodied But Unbowed while bloodied: for 1 minute your unarmed damage gains +3 plus your Exhaustion level. Once per long rest.",
    moxie: 0,
    apply: "down-but-not-out",
    when: "down-ready",
  },
  {
    id: "dodge",
    name: "Dodge",
    part: "action",
    summary: "Attacks against you have Disadvantage, and you have Advantage on Dexterity saves, until your next turn.",
    moxie: 0,
    apply: "moxie",
  },
  {
    id: "help",
    name: "Help",
    part: "action",
    summary: "An ally has Advantage on the next attack against a creature within 5 feet of you, or on an ability check.",
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
