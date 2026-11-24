export const AUTO_APPLY_CONFIDENCE = 0.8;
export const DUPLICATE_SIMILARITY = 0.85;
export const CLASSIFIER_TIMEOUT_MS = 5_000;

export interface TriageTask {
  id: string;
  tenantId: string;
  projectId: string;
  title: string;
  description?: string;
  /** Fields a human already set. The bot never overwrites them. */
  category?: string | null;
  priority?: string | null;
  teamId?: string | null;
}

export interface Proposal {
  category: string | null;
  priority: string | null;
  teamId: string | null;
  confidence: number;
}

export interface TriageRule {
  pattern: RegExp;
  category?: string;
  priority?: string;
  teamId?: string;
}

/** Deterministic stage. Teams here are placeholders: real rules come from per-project configuration. */
export const DEFAULT_RULES: readonly TriageRule[] = [
  { pattern: /\[crash\]|\b(crash(es|ed)?|exception|stack ?trace|returns? 5\d\d|http 5\d\d|error 5\d\d)\b/i, category: "Bug", priority: "High" },
  { pattern: /\b(checkout|payment|visa|mastercard|refund|card)\b/i, teamId: "payments" },
  { pattern: /\b(feature request|would be nice|please add)\b/i, category: "Feature", priority: "Low" },
];

export function applyRules(task: TriageTask, rules: readonly TriageRule[] = DEFAULT_RULES): Proposal {
  const text = `${task.title}\n${task.description ?? ""}`;
  const out: Proposal = { category: null, priority: null, teamId: null, confidence: 0 };
  let matched = 0;
  for (const r of rules) {
    if (!r.pattern.test(text)) continue;
    matched++;
    out.category ??= r.category ?? null;
    out.priority ??= r.priority ?? null;
    out.teamId ??= r.teamId ?? null;
  }
  const fields = [out.category, out.priority, out.teamId].filter(Boolean).length;
  out.confidence = matched === 0 ? 0 : fields >= 3 ? 0.9 : fields === 2 ? 0.82 : 0.5;
  return out;
}

export interface Candidate {
  taskId: string;
  tenantId: string;
  projectId: string;
  open: boolean;
  similarity: number;
}
export interface TriageDeps {
  classify?: (task: TriageTask) => Promise<Proposal>;
  findSimilar?: (task: TriageTask) => Promise<Candidate[]>;
  crossProject?: boolean;
  timeoutMs?: number;
}

export interface TriageResult {
  proposal: Proposal;
  duplicateOfTaskId: string | null;
  /** True when confidence >= 0.80 and the fields may be applied automatically. */
  autoApply: boolean;
  needsTriage: boolean;
  /** Only fields the human left empty. */
  applied: { category?: string; priority?: string; teamId?: string };
  fallbackReason?: "classifier_timeout" | "classifier_error";
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    );
  });
}

/** Never throws: task creation is not blocked by a classifier failure, the task goes to Needs Triage instead. */
export async function triageTask(task: TriageTask, deps: TriageDeps = {}): Promise<TriageResult> {
  let proposal = applyRules(task);
  let fallbackReason: TriageResult["fallbackReason"];
  if (proposal.confidence < AUTO_APPLY_CONFIDENCE && deps.classify) {
    try {
      proposal = await withTimeout(deps.classify(task), deps.timeoutMs ?? CLASSIFIER_TIMEOUT_MS);
    } catch (e) {
      fallbackReason = e instanceof Error && e.message === "timeout" ? "classifier_timeout" : "classifier_error";
    }
  }

  let duplicateOfTaskId: string | null = null;
  if (deps.findSimilar) {
    try {
      const best = (await deps.findSimilar(task))
        .filter(
          (c) =>
            c.open &&
            c.tenantId === task.tenantId &&
            c.taskId !== task.id &&
            (deps.crossProject || c.projectId === task.projectId) &&
            c.similarity >= DUPLICATE_SIMILARITY,
        )
        .sort((a, b) => b.similarity - a.similarity)[0];
      duplicateOfTaskId = best?.taskId ?? null;
    } catch {
      /* duplicate search is best effort */
    }
  }

  const autoApply = !fallbackReason && proposal.confidence >= AUTO_APPLY_CONFIDENCE;
  const applied: TriageResult["applied"] = {};
  if (autoApply) {
    if (!task.category && proposal.category) applied.category = proposal.category;
    if (!task.priority && proposal.priority) applied.priority = proposal.priority;
    if (!task.teamId && proposal.teamId) applied.teamId = proposal.teamId;
  }
  return { proposal, duplicateOfTaskId, autoApply, needsTriage: !autoApply, applied, fallbackReason };
}

export type TriageDecision = "accept" | "override";
export function resolveSuggestion(status: "pending" | "accepted" | "overridden", decision: TriageDecision) {
  if (status !== "pending") throw new Error("suggestion already resolved");
  return decision === "accept" ? ("accepted" as const) : ("overridden" as const);
}
