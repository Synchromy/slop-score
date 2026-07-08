import type { RulePack, SlopRule } from "./schema.js";

const synchromySource = {
  repo: "bhattman-dev/synchromy-site",
  path: "docs/brand-guide/voice.md",
  note: "Synchromy brand-voice hard rules; kept out of the universal pack.",
};

export const synchromyRules: SlopRule[] = [
  {
    id: "dash.em-or-en",
    kind: "regex",
    severity: "fail",
    scope: "line",
    pattern: "[—–]",
    packs: ["synchromy"],
    message: "Synchromy brand rule: no em or en dashes in reader-facing copy.",
    suggestion: "Rewrite with a period, comma, or colon.",
    source: synchromySource,
    flags: { splitReview: "accepted-synchromy" },
  },
  {
    id: "emoji.any",
    kind: "regex",
    severity: "fail",
    scope: "document",
    pattern: "\\p{Extended_Pictographic}",
    packs: ["synchromy"],
    message: "Synchromy brand rule: no emoji on brand surfaces.",
    suggestion: "Remove the emoji or replace it with precise words.",
    source: synchromySource,
    flags: { splitReview: "accepted-synchromy" },
  },
  {
    id: "spelling.british-english",
    kind: "denylist",
    severity: "warn",
    scope: "document",
    terms: ["optimize", "organization", "personalized", "program"],
    packs: ["synchromy"],
    message: "Synchromy brand rule: prefer British English spelling.",
    suggestion: "Use optimise, organisation, personalised, or programme where applicable.",
    source: synchromySource,
    flags: { splitReview: "accepted-synchromy" },
  },
];

export const synchromyPack: RulePack = {
  id: "synchromy",
  name: "Synchromy brand voice",
  description: "Synchromy-specific brand voice rules layered on top of universal slop rules.",
  rules: synchromyRules,
};
