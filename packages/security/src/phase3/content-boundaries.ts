import type { DataClassification } from "./data-classification.js";

export type ContentBoundaryFinding =
  | "CONTENT_TOO_LARGE"
  | "PROMPT_OVERRIDE"
  | "SYSTEM_PROMPT_DISCLOSURE"
  | "TOOL_MANIPULATION"
  | "SQL_INSTRUCTION"
  | "ENCODED_PAYLOAD";

export interface ContentBoundaryAssessment {
  readonly accepted: boolean;
  readonly findings: readonly ContentBoundaryFinding[];
  readonly boundedContent: string;
}

const patterns: ReadonlyArray<readonly [ContentBoundaryFinding, RegExp]> = [
  ["PROMPT_OVERRIDE", /ignore\s+(?:all\s+)?(?:previous|prior|system)\s+instructions|developer\s+message/i],
  ["SYSTEM_PROMPT_DISCLOSURE", /reveal|print|repeat|exfiltrat[\w]*.{0,40}(?:system prompt|hidden instructions|secrets?)/i],
  ["TOOL_MANIPULATION", /(?:call|invoke|execute|enable).{0,30}(?:tool|function|plugin)|tool_choice/i],
  ["SQL_INSTRUCTION", /\b(?:drop|truncate|alter|delete|update|insert)\s+(?:table|from|into|[a-z_])/i],
  ["ENCODED_PAYLOAD", /(?:base64|rot13|decode\s+this|data:text\/html)/i]
];

const MAX_UNTRUSTED_CONTENT = 50_000;

export function assessUntrustedContent(content: string): ContentBoundaryAssessment {
  const findings: ContentBoundaryFinding[] = [];
  if (content.length > MAX_UNTRUSTED_CONTENT) findings.push("CONTENT_TOO_LARGE");
  const boundedContent = content.slice(0, MAX_UNTRUSTED_CONTENT);
  for (const [finding, pattern] of patterns) {
    if (pattern.test(boundedContent)) findings.push(finding);
  }
  return { accepted: findings.length === 0, findings, boundedContent };
}

export interface ProviderContentBoundary {
  readonly classification: DataClassification;
  readonly providerApproved: boolean;
  readonly contentAssessmentAccepted: boolean;
  readonly toolRequested: string | null;
  readonly allowedTools: readonly string[];
}

export type ProviderContentDecision =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly reason: "RESTRICTED_DATA" | "PROVIDER_NOT_APPROVED" | "UNTRUSTED_CONTENT" | "TOOL_NOT_ALLOWED";
    };

export function authorizeProviderContent(boundary: ProviderContentBoundary): ProviderContentDecision {
  if (boundary.classification === "restricted") return { allowed: false, reason: "RESTRICTED_DATA" };
  if (!boundary.providerApproved) return { allowed: false, reason: "PROVIDER_NOT_APPROVED" };
  if (!boundary.contentAssessmentAccepted) return { allowed: false, reason: "UNTRUSTED_CONTENT" };
  if (boundary.toolRequested !== null && !boundary.allowedTools.includes(boundary.toolRequested)) {
    return { allowed: false, reason: "TOOL_NOT_ALLOWED" };
  }
  return { allowed: true };
}
