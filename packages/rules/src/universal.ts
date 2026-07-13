import type { RulePack, SlopRule } from "./schema.js";

const voiceLintSource = {
  repo: "bhattman-dev/synchromy-site",
  path: "scripts/voice-lint.mjs",
  note: "Ported from the shipping deterministic voice-lint script.",
};

export const killWords = [
  "delve",
  "delving",
  "showcase",
  "showcasing",
  "foster",
  "fostering",
  "seamless",
  "seamlessly",
  "crucial",
  "pivotal",
  "testament to",
  "tapestry",
  "nestled",
  "bustling",
  "garner",
  "bolstered",
  "cutting-edge",
  "state-of-the-art",
  "groundbreaking",
  "next-generation",
  "thought leader",
  "value proposition",
  "mission-critical",
  "end-to-end",
  "circle back",
  "deep dive",
  "drill down",
  "low-hanging fruit",
  "move the needle",
  "pain points",
  "holistic",
  "paradigm shift",
  "synergy",
  "harness the power",
  "unleash the potential",
  "embark on a journey",
  "push the boundaries",
  "navigate the complexit",
  "lay the groundwork",
  "pave the way",
  "bridging the gap",
  "explore new frontiers",
  "revolutionise the way",
  "supercharge",
  "ai-powered everything",
  "transformation journey",
  "future-proof",
  "unlock your potential",
] as const;

export const earnedWords = [
  "leverage",
  "unlock",
  "empower",
  "robust",
  "transformation",
  "magic",
] as const;

export const sentenceOpeners = [
  "Additionally",
  "Furthermore",
  "Moreover",
  "Subsequently",
  "Accordingly",
  "Consequently",
  "Indeed",
  "Notably",
  "It is worth noting that",
  "It is important to note that",
  "That being said",
  "In conclusion",
  "Ultimately",
  "Moving forward",
] as const;

export const nextWaveTells = ["Here's the thing:", "Let's be real.", "Let’s be real."] as const;

export const cringePatterns = [
  { pattern: "\\bsit(?:ting)?\\s+with\\s+(?:that|this|it)\\b", label: "sit with that/this/it" },
  { pattern: "\\bto\\s+sit\\s+with\\b(?!\\s+\\S)", label: "...to sit with" },
  { pattern: "\\blet\\s+that\\s+sink\\s+in\\b", label: "let that sink in" },
  { pattern: "\\bread\\s+that\\s+again\\b", label: "read that again" },
  { pattern: "\\bsay\\s+it\\s+louder\\b", label: "say it louder" },
  {
    pattern: "\\bfor\\s+(?:the\\s+people|those)\\s+(?:in|at)\\s+the\\s+back\\b",
    label: "for the people at the back",
  },
] as const;

export const hedgeTerms = [
  "arguably",
  "perhaps",
  "in many ways",
  "to some extent",
  "generally speaking",
  "it could be argued",
] as const;

const ambiguousKillWords = new Set<string>([
  "showcase",
  "showcasing",
  "foster",
  "fostering",
  "value proposition",
  "mission-critical",
  "end-to-end",
  "circle back",
  "deep dive",
  "drill down",
  "pain points",
  "holistic",
  "supercharge",
  "transformation journey",
  "future-proof",
]);

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function splitFlags(term: string): SlopRule["flags"] {
  if (!ambiguousKillWords.has(term)) return { splitReview: "accepted-universal" };
  return {
    splitReview: "ambiguous",
    reviewNote:
      "First-pass universal placement only. Needs Khoa/Neel review before treating as settled.",
  };
}

export const universalRules: SlopRule[] = [
  {
    id: "dash.em-or-en",
    kind: "regex",
    severity: "warn",
    scope: "line",
    pattern: "[—–]",
    packs: ["universal"],
    message: "Dash cadence can make copy read machine-shaped or over-styled.",
    suggestion: "Use a period, comma, or colon unless the brand pack allows the dash.",
    source: voiceLintSource,
    flags: { splitReview: "accepted-universal" },
  },
  ...killWords.map<SlopRule>((term) => ({
    id: `kill-word.${slug(term)}`,
    kind: "phrase",
    severity: "fail",
    scope: "line",
    match: term,
    packs: ["universal"],
    message: `Kill-list vocabulary: "${term}".`,
    suggestion: "Name the concrete behavior instead.",
    source: voiceLintSource,
    flags: splitFlags(term),
  })),
  ...earnedWords.map<SlopRule>((term) => ({
    id: `earned-use.${slug(term)}`,
    kind: "phrase",
    severity: "warn",
    scope: "line",
    match: term,
    packs: ["universal"],
    message: `Earned-use word: "${term}" needs concrete support.`,
    suggestion: "Keep it only if the sentence proves the word with specific evidence.",
    source: voiceLintSource,
    flags: { splitReview: "accepted-universal" },
  })),
  ...sentenceOpeners.map<SlopRule>((opener) => ({
    id: `opener.${slug(opener)}`,
    kind: "phrase",
    severity: "fail",
    scope: "sentence-start",
    match: opener,
    packs: ["universal"],
    message: `AI sentence-opener crutch: "${opener}".`,
    suggestion: "Start with the subject or use the actual relationship: but, so, because.",
    source: voiceLintSource,
    flags: { splitReview: "accepted-universal" },
  })),
  ...nextWaveTells.map<SlopRule>((tell) => ({
    id: `next-wave.${slug(tell)}`,
    kind: "phrase",
    severity: "fail",
    scope: "sentence",
    match: tell,
    packs: ["universal"],
    message: `Next-wave tell: "${tell}".`,
    suggestion: "Say the point directly without the social-post setup.",
    source: voiceLintSource,
    flags: { splitReview: "accepted-universal" },
  })),
  ...cringePatterns.map<SlopRule>((entry) => ({
    id: `cringe.${slug(entry.label)}`,
    kind: "regex",
    severity: "fail",
    scope: "sentence",
    pattern: entry.pattern,
    packs: ["universal"],
    message: `Stock engagement-bait phrasing: "${entry.label}".`,
    suggestion: "Replace the performance cue with the actual idea.",
    source: voiceLintSource,
    flags: { splitReview: "accepted-universal" },
  })),
  {
    id: "cadence.fragment-staccato",
    kind: "cadence",
    severity: "fail",
    scope: "document",
    threshold: 3,
    window: 5,
    packs: ["universal"],
    message: "Staccato run: several very short sentences in a row read like false emphasis.",
    suggestion: "Combine the fragments into one specific sentence with a concrete claim.",
    source: {
      repo: "bhattman-dev/synchromy-site",
      path: "docs/brand-guide/voice.md",
      note: "Mechanized from the brand-guide ban on fragment/staccato emphasis.",
    },
    flags: { splitReview: "accepted-universal" },
  },
  {
    id: "density.forced-threes",
    kind: "density",
    severity: "warn",
    scope: "sentence",
    threshold: 1,
    pattern:
      "\\b[a-z][a-z-]*(?:\\s+[a-z][a-z-]*){0,2},\\s+[a-z][a-z-]*(?:\\s+[a-z][a-z-]*){0,2},\\s+(?:and\\s+)?[a-z][a-z-]*(?:\\s+[a-z][a-z-]*){0,2}\\b",
    packs: ["universal"],
    message: "Forced rule-of-three list can make prose sound templated.",
    suggestion: "Keep the list only if all three items are necessary and specific.",
    source: {
      repo: "bhattman-dev/synchromy-site",
      path: "docs/brand-guide/voice.md",
      note: "Mechanized from the brand-guide ban on forced threes.",
    },
    flags: { splitReview: "accepted-universal" },
  },
  {
    id: "density.hedge-stacking",
    kind: "density",
    severity: "warn",
    scope: "document",
    threshold: 2,
    terms: [...hedgeTerms],
    packs: ["universal"],
    message: "Hedge-word stacking makes the claim feel evasive.",
    suggestion: "Cut the hedge or replace it with the concrete condition that matters.",
    source: {
      repo: "bhattman-dev/synchromy-site",
      path: "docs/brand-guide/voice.md",
      note: "Mechanized from the v1 Slop Score differentiator brief.",
    },
    flags: { splitReview: "accepted-universal" },
  },
  {
    id: "density.title-case-nouns",
    kind: "density",
    severity: "warn",
    scope: "document",
    threshold: 1,
    pattern: "\\b[A-Z][a-z]+(?:\\s+[A-Z][a-z]+){1,2}\\b",
    packs: ["universal"],
    message: "Title-case noun phrase can make invented concepts feel inflated.",
    suggestion: "Use normal casing unless this is a real product, company, or established term.",
    source: {
      repo: "bhattman-dev/synchromy-site",
      path: "docs/brand-guide/voice.md",
      note: "Mechanized from the brand-guide title-case noun concern.",
    },
    flags: { splitReview: "accepted-universal" },
  },
  {
    id: "padding.ing-tail",
    kind: "regex",
    severity: "warn",
    scope: "sentence",
    pattern:
      ",\\s+\\p{L}+ing\\b(?:\\s+\\p{L}+){0,3}(?:,\\s+(?:and\\s+)?\\p{L}+ing\\b(?:\\s+\\p{L}+){0,3})+",
    packs: ["universal"],
    message: "Stacked -ing tail adds motion without adding concrete content.",
    suggestion: "Cut the trailing participial padding or replace it with the actual result.",
    source: {
      repo: "bhattman-dev/synchromy-site",
      path: "docs/brand-guide/voice.md",
      note: "Mechanized from the brand-guide ban on -ing tails.",
    },
    flags: { splitReview: "accepted-universal" },
  },
  {
    id: "emoji.any-advisory",
    kind: "regex",
    severity: "warn",
    scope: "document",
    pattern: "\\p{Extended_Pictographic}",
    packs: ["universal"],
    message: "Emoji can make public copy read casual or engagement-bait shaped.",
    suggestion: "Keep it only if the target brand voice explicitly wants emoji.",
    source: {
      repo: "bhattman-dev/synchromy-site",
      path: "docs/brand-guide/voice.md",
      note: "Universal advisory version of the Synchromy strict emoji sweep.",
    },
    flags: { splitReview: "accepted-universal" },
  },
];

export const universalPack: RulePack = {
  id: "universal",
  name: "Universal slop signals",
  description: "Provider-neutral signs that copy reads lazy, machine-shaped, or over-styled.",
  rules: universalRules,
};
