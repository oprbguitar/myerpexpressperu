import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENVIRONMENT: z.enum(["development", "test", "demo", "production"]).default("development"),
  APP_URL: z.url(),
  APP_PUBLIC_URL: z.url().optional(),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  SESSION_TTL: z.coerce.number().int().positive().default(28800),
  PASSWORD_RESET_TTL: z.coerce.number().int().positive().default(1800),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_BLOCK_SECONDS: z.coerce.number().int().positive().default(900),
  COOKIE_SECURE: z.stringbool().default(false),
  PORT: z.coerce.number().int().positive().default(3100),
  DEMO_MODE: z.stringbool().default(false),
  DEMO_RESET_ENABLED: z.stringbool().default(false),
  DEMO_TENANT_ID: z.string().uuid().optional().or(z.literal("")),
  DEMO_DATABASE_FINGERPRINT: z.string().max(200).optional().or(z.literal("")),
  DEMO_MAX_USERS: z.coerce.number().int().positive().default(25),
  DEMO_MAX_RECORDS: z.coerce.number().int().positive().default(10000),
  PROVIDER_SECRET_STORE: z.enum(["environment", "external"]).default("environment"),
  AI_ENABLED: z.stringbool().default(false),
  AI_PROVIDER: z.string().max(100).default("none"),
  AI_BASE_URL: z.url().optional().or(z.literal("")),
  AI_MODEL: z.string().max(200).optional().or(z.literal("")),
  AI_DAILY_BUDGET: z.coerce.number().nonnegative().default(0),
  AI_MONTHLY_BUDGET: z.coerce.number().nonnegative().default(0),
  AI_LOG_CONTENT: z.stringbool().default(false),
  OCR_ENABLED: z.stringbool().default(false),
  OCR_PROVIDER: z.string().max(100).default("mock"),
  OCR_BASE_URL: z.url().optional().or(z.literal("")),
  OCR_MAX_FILE_SIZE: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  MAPS_ENABLED: z.stringbool().default(false),
  GEOCODING_PROVIDER: z.string().max(100).default("manual"),
  GEOCODING_BASE_URL: z.url().optional().or(z.literal(""))
}).superRefine((value, context) => {
  if (value.APP_ENVIRONMENT === "production" && value.DEMO_MODE) {
    context.addIssue({ code: "custom", path: ["DEMO_MODE"], message: "DEMO_MODE no puede habilitarse en producción." });
  }
  if (value.DEMO_RESET_ENABLED && (value.APP_ENVIRONMENT !== "demo" || !value.DEMO_TENANT_ID || !value.DEMO_DATABASE_FINGERPRINT)) {
    context.addIssue({
      code: "custom",
      path: ["DEMO_RESET_ENABLED"],
      message: "El reset demo exige entorno demo, tenant y fingerprint."
    });
  }
  if (value.AI_ENABLED && value.AI_PROVIDER === "none") {
    context.addIssue({ code: "custom", path: ["AI_PROVIDER"], message: "AI_PROVIDER es obligatorio cuando AI_ENABLED=true." });
  }
});

const result = schema.safeParse(process.env);
if (!result.success) {
  throw new Error(`Configuración inválida: ${z.prettifyError(result.error)}`);
}
export const config = result.data;
