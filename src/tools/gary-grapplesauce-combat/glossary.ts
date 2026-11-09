/**
 * Feature blurbs for tooltips.
 * Primary source: Sterling Vermin Pugilist (2024) on D&D Beyond —
 * https://www.dndbeyond.com/posts/2130-the-pugilist-class-comes-brawling-onto-d-d-beyond
 * Gary-specific numbers (level 9, Con +3, Fisticuffs d10) called out where relevant.
 */

import {
  CONDITION_DEFS,
  EXHAUSTION_SUMMARY,
  PUGILIST_POST_URL,
  RULES_GLOSSARY_URL,
  conditionHref,
} from "./conditions";

export type GlossaryEntry = {
  id: string;
  label: string;
  summary: string;
  source?: string;
  href?: string;
  kind?: "feature" | "condition";
};

export const GLOSSARY: Record<string, GlossaryEntry> = {
  fisticuffs: {
    id: "fisticuffs",
    label: "Fisticuffs",
    summary:
      "While unarmed or wielding only Pugilist weapons, in light or no armor and no shield: Unarmed Strikes and Pugilist weapons deal 1d10 + Strength, you can make one Unarmed Strike as a Bonus Action, and a damage die that shows 1 is rerolled once.",
    source: "Pugilist 2024 · DDB post",
  },
  "iron-chin": {
    id: "iron-chin",
    label: "Iron Chin",
    summary:
      "While wearing Light or no armor (and no shield), you can use Constitution instead of Dexterity for AC. Gary’s Iron Chin is 12 + Con (+ wraps/towel on top).",
    source: "Pugilist 2024 · DDB post",
  },
  moxie: {
    id: "moxie",
    label: "Moxie",
    summary:
      "A pool of 5 points. You spend them on Brace Up, One-Two Punch, Stick and Move, Haymaker, Swagger Streak, Inescapable, and Meat Shield. You regain all expended points on a Short or Long Rest, and when you use Bloodied But Unbowed.",
    source: "Pugilist 2024 · DDB post",
  },
  "brace-up": {
    id: "brace-up",
    label: "Brace Up",
    summary:
      "Bonus Action, spend 1 Moxie: gain Temporary Hit Points. Sheet math for Gary: Fisticuffs die + Pugilist level + Con = 1d10 + 9 + 3 → 1d10 + 12.",
    source: "Pugilist · Brace Up (Moxie)",
  },
  "one-two": {
    id: "one-two",
    label: "One-Two (Old One-Two)",
    summary: "Bonus Action: expend 1 Moxie and make two Unarmed Strikes.",
    source: "Pugilist 2024 · Moxie / DDB post",
  },
  "stick-and-move": {
    id: "stick-and-move",
    label: "Stick and Move",
    summary:
      "Bonus Action, spend 1 Moxie: make an Unarmed Strike and take the Dash or Disengage action as part of the same Bonus Action (2024 Moxie options).",
    source: "Pugilist 2024 · DDB post",
  },
  "bloodied-but-unbowed": {
    id: "bloodied-but-unbowed",
    label: "Bloodied But Unbowed",
    summary:
      "Reaction when you take damage: regain all expended Moxie. If you are bloodied when you take the reaction, also gain 36 temporary hit points until you finish a short rest. Once per short or long rest.",
    source: "Pugilist 2024 · DDB post",
  },
  "dig-deep": {
    id: "dig-deep",
    label: "Dig Deep",
    summary:
      "Bonus Action, once per long rest, for 10 minutes: Resistance to bludgeoning, piercing, and slashing, and you ignore Exhaustion below 6. You can gain 1 Exhaustion (no action) to restore the use, but not if that would reach 6.",
    source: "Pugilist 2024 · DDB post",
  },
  "heavy-hitter": {
    id: "heavy-hitter",
    label: "Heavy Hitter",
    summary:
      "When you hit with an Unarmed Strike, you deal damage and can also Grapple or Shove the target (so fists still get a mastery-like rider).",
    source: "Pugilist 2024 · DDB post",
  },
  haymaker: {
    id: "haymaker",
    label: "Haymaker",
    summary:
      "When you attack with an Unarmed Strike or Pugilist weapon, expend 1 Moxie. On a hit, deal maximum damage and regain that Moxie. On a miss, the Moxie stays spent.",
    source: "Pugilist 2024 · DDB post",
  },
  "swagger-streak": {
    id: "swagger-streak",
    label: "Swagger Streak",
    summary:
      "When you fail a Strength, Dexterity, Constitution, or Charisma check, expend 1 Moxie and add 1d10. If the check still fails, you regain that Moxie and cannot use this again until a short or long rest. If it succeeds, the Moxie stays spent.",
    source: "Pugilist · sheet feature (verify on DDB)",
  },
  "squared-circle": {
    id: "squared-circle",
    label: "Squared Circle",
    summary:
      "Grappling subclass. Groundwork tools lock foes down (grapple/shove riders, escape pressure, ongoing damage while holding). Built to wrestle the biggest threat and keep them stuck.",
    source: "Pugilist 2024 · Squared Circle / DDB post",
  },
  "stop-and-drop": {
    id: "stop-and-drop",
    label: "Stop and Drop",
    summary:
      "Squared Circle control: on a hit with an Unarmed Strike (without using a mastery property), you can Grapple and Shove as part of the same hit — put them on the mat.",
    source: "Squared Circle · sheet / Groundwork",
  },
  inescapable: {
    id: "inescapable",
    label: "Inescapable",
    summary:
      "Spend 1 Moxie so a creature has Disadvantage on a check or save to escape your grapple/shove (Groundwork pressure).",
    source: "Squared Circle · Groundwork",
  },
  "compression-lock": {
    id: "compression-lock",
    label: "Compression Lock",
    summary:
      "No action. When you start your turn with a creature grappled, you can deal 1d10 + 5 bludgeoning to each of them.",
    source: "Squared Circle · Groundwork",
  },
  bloodied: {
    id: "bloodied",
    label: "Bloodied",
    summary:
      "A creature is Bloodied while it has half its Hit Points or fewer. Gary’s threshold is half of current max HP (51 with his usual gear). Many Pugilist comeback features key off this.",
    source: "2024 Rules Glossary · Bloodied",
    href: `${RULES_GLOSSARY_URL}#Bloodied`,
  },
  exhaustion: {
    id: "exhaustion",
    label: "Exhaustion",
    summary: `${EXHAUSTION_SUMMARY} Dig Deep’s extra uses cost 1 level each.`,
    source: "2024 Rules Glossary · Exhaustion",
    href: conditionHref("Exhaustion"),
  },
  ...Object.fromEntries(
    CONDITION_DEFS.map((c) => [
      `cond-${c.id}`,
      {
        id: `cond-${c.id}`,
        label: c.label,
        summary: c.summary,
        source: `2024 Rules Glossary · ${c.label}`,
        href: conditionHref(c.label),
        kind: "condition",
      } satisfies GlossaryEntry,
    ]),
  ),
};

for (const entry of Object.values(GLOSSARY)) {
  entry.kind ??= "feature";
  entry.href ??= PUGILIST_POST_URL;
}

/** Keys that appear in UI labels → glossary id */
export const TIP_ALIASES: Record<string, keyof typeof GLOSSARY> = {
  "Dig Deep": "dig-deep",
  "Brace Up": "brace-up",
  "Bloodied But Unbowed": "bloodied-but-unbowed",
  Bloodied: "bloodied",
  Moxie: "moxie",
  "Swagger Streak": "swagger-streak",
  "One-Two": "one-two",
  "One-Two Punch": "one-two",
  "Stick and Move": "stick-and-move",
  "Heavy Hitter": "heavy-hitter",
  Fisticuffs: "fisticuffs",
  "Iron Chin": "iron-chin",
  Haymaker: "haymaker",
  "Stop and Drop": "stop-and-drop",
  Inescapable: "inescapable",
  "Compression Lock": "compression-lock",
  Exhaustion: "exhaustion",
  "Squared Circle": "squared-circle",
};
