/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { randomUUID } from "node:crypto";
import {
  ArgumentsHost,
  Catch,
  HttpException,
  Injectable,
  NestInterceptor,
  type CallHandler,
  type ExceptionFilter,
  type ExecutionContext
} from "@nestjs/common";
import type { Observable } from "rxjs";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthenticatedContext } from "@erp/contracts";
import { DomainValidationError } from "@erp/domain";

export interface ApiRequest extends FastifyRequest {
  requestId: string;
  auth?: AuthenticatedContext;
}

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<ApiRequest>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();
    request.requestId = request.headers["x-request-id"]?.toString().slice(0, 100) || randomUUID();
    reply.header("x-request-id", request.requestId);
    return next.handle();
  }
}

interface RateWindow {
  count: number;
  resetAt: number;
}

@Injectable()
export class LocalRateLimitInterceptor implements NestInterceptor {
  private readonly windows = new Map<string, RateWindow>();
  private readonly windowMilliseconds = 60_000;
  private readonly maximumRequests = 120;

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<ApiRequest>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();
    const now = Date.now();
    const key = request.auth?.sessionId ?? `ip:${request.ip}`;
    const existing = this.windows.get(key);
    const window = !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + this.windowMilliseconds }
      : existing;
    window.count += 1;
    this.windows.set(key, window);
    reply.header("x-ratelimit-limit", this.maximumRequests);
    reply.header("x-ratelimit-remaining", Math.max(0, this.maximumRequests - window.count));
    reply.header("x-ratelimit-reset", Math.ceil(window.resetAt / 1000));
    if (window.count > this.maximumRequests) {
      throw new HttpException("Demasiadas solicitudes. Intente nuevamente en un minuto.", 429);
    }
    if (this.windows.size > 10_000) {
      for (const [candidateKey, candidate] of this.windows) {
        if (candidate.resetAt <= now) this.windows.delete(candidateKey);
      }
    }
    return next.handle();
  }
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<ApiRequest>();
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    let status = 500;
    let code = "INTERNAL_ERROR";
    let message = "Ocurrió un error inesperado.";
    let details: unknown[] = [];
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      code = status === 401 ? "AUTHENTICATION_REQUIRED" : status === 403 ? "PERMISSION_DENIED" : "REQUEST_ERROR";
      message = typeof response === "string" ? response : exception.message;
    } else if (exception instanceof DomainValidationError) {
      status = 422;
      code = exception.code;
      message = exception.message;
      details = [...exception.details];
    } else if (process.env.NODE_ENV !== "production") {
      console.error(exception);
    }
    void reply.status(status).send({
      error: { code, message, details, requestId: request.requestId ?? "unavailable" }
    });
  }
}
