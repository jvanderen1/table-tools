/** A situation on the Play tab. It only names action ids from the catalog. */

export type PlaybookWhen = "turn" | "reaction" | "check";

export type PlaybookDef = {
  id: string;
  title: string;
  blurb: string;
  gym: string;
  when: PlaybookWhen;
  tag: string;
  actionIds: string[];
};

export type CustomPlaybook = {
  id: string;
  title: string;
  blurb: string;
  when: PlaybookWhen;
  actionIds: string[];
};

export const PLAYBOOKS: PlaybookDef[] = [
  {
    id: "shut-down-caster",
    title: "Shut down the caster",
    blurb: "Get on them and stay there. The reaction strike is free.",
    gym: "HEY. Soften the wizard.",
    when: "turn",
    tag: "Caster",
    actionIds: ["attack", "stick-and-move", "one-two", "mage-slayer"],
  },
  {
    id: "meat-shield",
    title: "Meat Shield",
    blurb:
      "Grapple someone first. Half cover against everyone else is free while you hold them. This reaction spends 1 Moxie to redirect a miss.",
    gym: "Hug the problem.",
    when: "turn",
    tag: "Grapple",
    actionIds: ["attack", "meat-shield", "compression-lock", "inescapable"],
  },
  {
    id: "deal-damage",
    title: "Deal damage",
    blurb: "Two swings, then a bonus strike. Haymaker only if you can afford a miss.",
    gym: 'The One-Two. "Cardio."',
    when: "turn",
    tag: "Damage",
    actionIds: ["attack", "hard-knocks", "haymaker", "one-two", "fisticuffs"],
  },
  {
    id: "lock-down",
    title: "Lock them down",
    blurb: "Put them on the mat and keep the hug. Compression Lock ticks at the start of your turn.",
    gym: "Sit Down. Still Hugging.",
    when: "turn",
    tag: "Control",
    actionIds: ["attack", "inescapable", "compression-lock"],
  },
  {
    id: "stay-standing",
    title: "Stay standing",
    blurb: "Temp HP now. Dig Deep if the hits are weapon damage. Bloodied is the reaction later.",
    gym: "Flex. Leg Day.",
    when: "turn",
    tag: "Survive",
    actionIds: ["brace-up", "dig-deep", "dig-deep-again", "dodge", "bloodied"],
  },
  {
    id: "close-gap",
    title: "Close the gap",
    blurb: "One Moxie buys the punch and the movement.",
    gym: "Bounce, don't plant.",
    when: "turn",
    tag: "Move",
    actionIds: ["stick-and-move", "attack"],
  },
  {
    id: "comeback",
    title: "Bloodied comeback",
    blurb: "You already took the hit while bloodied. Refill, then turn the damage up.",
    gym: "Not done. Spot me.",
    when: "turn",
    tag: "Comeback",
    actionIds: ["bloodied", "down-but-not-out", "attack"],
  },
  {
    id: "default-loop",
    title: "Not sure",
    blurb: "Punch, then the free bonus strike. Save Moxie.",
    gym: "If unsure: punch, then offer a spot.",
    when: "turn",
    tag: "Default",
    actionIds: ["attack", "fisticuffs", "hard-knocks"],
  },
  {
    id: "react-meat-shield",
    title: "Meat Shield",
    blurb: "Someone you are not grappling missed you. Half cover was already on. This spends 1 Moxie to redirect the attack.",
    gym: "Hug the problem.",
    when: "reaction",
    tag: "Reaction",
    actionIds: ["meat-shield"],
  },
  {
    id: "react-bloodied",
    title: "Bloodied + damage",
    blurb: "You took damage. If you are bloodied, this also grants 36 temp HP.",
    gym: "Not done. Spot me.",
    when: "reaction",
    tag: "Reaction",
    actionIds: ["bloodied", "down-but-not-out"],
  },
  {
    id: "react-mage",
    title: "Spell within 5 ft",
    blurb: "They cast with a spell slot next to you.",
    gym: "HEY.",
    when: "reaction",
    tag: "Reaction",
    actionIds: ["mage-slayer"],
  },
  {
    id: "react-opportunity",
    title: "Left my reach",
    blurb: "Punish the step back.",
    gym: "Still Hugging.",
    when: "reaction",
    tag: "Reaction",
    actionIds: ["opportunity"],
  },
  {
    id: "failed-roll",
    title: "Failed roll",
    blurb: "Swagger is a Str, Dex, Con, or Cha check. Guarded Mind is an Int, Wis, or Cha save.",
    gym: "One more rep.",
    when: "check",
    tag: "Check",
    actionIds: ["swagger", "guarded-mind"],
  },
];
