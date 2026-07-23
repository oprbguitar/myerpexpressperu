import { z } from "zod";

export const aiQuerySchema = z.object({
  prompt: z.string().trim().min(1).max(2_000),
  tool: z.object({
    name: z.string().min(3).max(100),
    input: z.unknown()
  }).optional(),
  documents: z.array(z.object({
    sourceId: z.string().min(1).max(100),
    content: z.string().max(50_000),
    dataCategories: z.array(z.enum([
      "PUBLIC",
      "INTERNAL",
      "BUSINESS_CONTACT",
      "PERSONAL",
      "FINANCIAL",
      "MEDICAL",
      "CREDENTIAL",
      "PROVIDER_SECRET"
    ])).max(8)
  }).strict()).max(5).default([]),
  maximumOutputTokens: z.number().int().min(32).max(2_000).default(500)
}).strict();

export type AiQueryInput = z.infer<typeof aiQuerySchema>;

export const aiFeedbackSchema = z.object({
  interactionId: z.string().uuid(),
  rating: z.enum(["HELPFUL", "NOT_HELPFUL", "UNSAFE"]),
  comment: z.string().trim().max(1_000).optional()
}).strict();

export type AiFeedbackInput = z.infer<typeof aiFeedbackSchema>;

