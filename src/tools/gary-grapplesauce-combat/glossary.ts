/**
 * Feature blurbs for tooltips.
 * Primary source: Sterling Vermin Pugilist (2024) on D&D Beyond —
 * https://www.dndbeyond.com/posts/2130-the-pugilist-class-comes-brawling-onto-d-d-beyond
 * Gary-specific numbers (level 9, Con +3, Fisticuffs d10) called out where relevant.
 */

export type GlossaryEntry = {
  id: string;
  label: string;
  summary: string;
  source?: string;
};

export const GLOSSARY: Record<string, GlossaryEntry> = {
  fisticuffs: {
    id: "fisticuffs",
    label: "Fisticuffs",
    summary:
      "Your Unarmed Strikes (and Pugilist weapons) use the Fisticuffs die for damage and you can make an extra Unarmed Strike as a Bonus Action when you Attack with fists/pugilist weapons. At level 9 Gary’s die is 1d10 (+ Str).",
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
      "A pool of points (Gary: 5) spent on Bonus Action options. You regain all Moxie on a Short or Long Rest, and when you use Bloodied But Unbowed.",
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
    summary:
      "Bonus Action after the Attack action: spend 1 Moxie to make two Unarmed Strikes.",
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
      "Reaction when you have the Bloodied condition or take damage while Bloodied: gain Temporary Hit Points equal to 4 × Pugilist level (36 at 9) and regain all expended Moxie. Recharges on a Short or Long Rest.",
    source: "Pugilist 2024 · DDB post",
  },
  "dig-deep": {
    id: "dig-deep",
    label: "Dig Deep",
    summary:
      "Temporarily gain Resistance to Bludgeoning, Piercing, and Slashing damage. First use costs nothing; you can use it again by gaining 1 Exhaustion. Track “active” while the resistance is up.",
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
      "Gamble 1 Moxie on an Unarmed Strike / Pugilist weapon attack: on a hit, deal maximum damage (no roll) and get the Moxie back; on a miss, the Moxie is lost.",
    source: "Pugilist 2024 · DDB post",
  },
  "swagger-streak": {
    id: "swagger-streak",
    label: "Swagger Streak",
    summary:
      "When you fail a Strength, Dexterity, Constitution, or Charisma check, you can add 1d10 to the result (1/short rest). Tracked on Gary’s sheet; confirm exact wording on DDB if disputed.",
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
      "While you have a creature grappled, it takes ongoing unarmed damage (Gary: Fisticuffs + Str) — keep the hug going.",
    source: "Squared Circle · Groundwork",
  },
  bloodied: {
    id: "bloodied",
    label: "Bloodied",
    summary:
      "You have the Bloodied condition while at half Hit Points or fewer (Gary: HP ≤ 51). Many Pugilist comeback features key off this.",
    source: "5e · Bloodied condition",
  },
  exhaustion: {
    id: "exhaustion",
    label: "Exhaustion",
    summary:
      "A stacking condition (levels 1–6) with growing penalties. Dig Deep’s extra uses can cost Exhaustion. A Long Rest typically reduces Exhaustion by 1.",
    source: "5e · Exhaustion",
  },
};

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
