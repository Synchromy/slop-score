import { z } from "zod";

export const ruleKindSchema = z.enum(["phrase", "regex", "denylist", "density", "cadence"]);
export type RuleKind = z.infer<typeof ruleKindSchema>;

export const severitySchema = z.enum(["fail", "warn"]);
export type Severity = z.infer<typeof severitySchema>;

export const ruleScopeSchema = z.enum(["line", "sentence", "sentence-start", "document"]);
export type RuleScope = z.infer<typeof ruleScopeSchema>;

export const packIdSchema = z.enum(["universal", "synchromy"]);
export type PackId = z.infer<typeof packIdSchema>;

export const splitReviewSchema = z.enum(["accepted-universal", "accepted-synchromy", "ambiguous"]);
export type SplitReview = z.infer<typeof splitReviewSchema>;

export const ruleSourceSchema = z.object({
  repo: z.string(),
  path: z.string(),
  note: z.string(),
});
export type RuleSource = z.infer<typeof ruleSourceSchema>;

export const ruleFlagsSchema = z
  .object({
    splitReview: splitReviewSchema.optional(),
    reviewNote: z.string().optional(),
  })
  .strict();
export type RuleFlags = z.infer<typeof ruleFlagsSchema>;

export const slopRuleSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/),
    kind: ruleKindSchema,
    severity: severitySchema,
    scope: ruleScopeSchema,
    message: z.string().min(1),
    suggestion: z.string().min(1),
    packs: z.array(packIdSchema).min(1),
    match: z.string().min(1).optional(),
    pattern: z.string().min(1).optional(),
    terms: z.array(z.string().min(1)).optional(),
    threshold: z.number().positive().optional(),
    window: z.number().int().positive().optional(),
    source: ruleSourceSchema.optional(),
    flags: ruleFlagsSchema.optional(),
  })
  .strict()
  .superRefine((rule, ctx) => {
    if ((rule.kind === "phrase" || rule.kind === "regex") && !rule.match && !rule.pattern) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["match"],
        message: "phrase and regex rules require match or pattern",
      });
    }
    if (rule.kind === "denylist" && (!rule.terms || rule.terms.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["terms"],
        message: "denylist rules require terms",
      });
    }
    if ((rule.kind === "density" || rule.kind === "cadence") && !rule.threshold) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["threshold"],
        message: "density and cadence rules require threshold",
      });
    }
  });

export type SlopRule = z.infer<typeof slopRuleSchema>;

export const rulePackSchema = z
  .object({
    id: packIdSchema,
    name: z.string().min(1),
    description: z.string().min(1),
    rules: z.array(slopRuleSchema),
  })
  .strict();
export type RulePack = z.infer<typeof rulePackSchema>;
