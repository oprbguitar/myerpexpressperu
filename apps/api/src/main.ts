/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import "reflect-metadata";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";
import { config } from "./config.js";

/**
 * Confianza en proxies inversos.
 *
 * `trustProxy: true` incondicional acepta `X-Forwarded-For` de CUALQUIER
 * origen. Como esa IP alimenta el limitador de tasa, la auditoría y la
 * evidencia de aceptación legal, un cliente directo podía falsificarla y
 * evadir por completo el límite de peticiones rotando la cabecera.
 *
 * Ahora sólo se confía en los proxies declarados explícitamente en
 * TRUSTED_PROXIES. Si la lista está vacía se usa la dirección real del
 * socket y las cabeceras de reenvío se ignoran.
 */
const trustedProxies = config.TRUSTED_PROXIES.split(",")
  .map((entry) => entry.trim())
  .filter((entry) => entry.length > 0);

const adapter = new FastifyAdapter({
  trustProxy: trustedProxies.length > 0 ? trustedProxies : false,
  logger: { level: process.env.LOG_LEVEL ?? "info" }
});
const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter);
await app.register(cookie);
await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      imgSrc: ["'self'", "data:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    }
  },
  hsts: config.NODE_ENV === "production" ? { maxAge: 31_536_000, includeSubDomains: true } : false,
  referrerPolicy: { policy: "no-referrer" }
});
app.enableCors({ origin: config.APP_URL, credentials: true, methods: ["GET", "POST", "PATCH", "DELETE"] });
app.setGlobalPrefix("api/v1");
app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
const document = SwaggerModule.createDocument(
  app,
  new DocumentBuilder()
    .setTitle("ERP Express Perú API")
    .setDescription("Contrato HTTP portable para el núcleo y la operación comercial")
    .setVersion("2.0")
    .addCookieAuth("erp_session")
    .build()
);
SwaggerModule.setup("api/docs", app, document);
await app.listen({ port: config.PORT, host: "0.0.0.0" });
