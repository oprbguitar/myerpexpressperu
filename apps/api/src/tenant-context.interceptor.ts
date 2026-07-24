/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { from, type Observable } from "rxjs";
import { lastValueFrom } from "rxjs";
import { DatabaseService } from "./database.service.js";
import type { ApiRequest } from "./http.js";

/**
 * Establece el contexto de tenant a nivel de base de datos para toda petición
 * autenticada. Corre DESPUÉS de AuthGuard (que rellena `request.auth`) y envuelve
 * la ejecución del handler en un cliente dedicado con `app.tenant_id` fijado, de
 * modo que las políticas RLS se aplican a cada consulta del handler.
 *
 * Las peticiones sin `request.auth` (login, salud) no reciben contexto y usan el
 * pool directamente, alcanzando solo tablas de sistema sin política RLS.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly database: DatabaseService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<ApiRequest>();
    const auth = request.auth;
    if (!auth) return next.handle();
    return from(
      this.database.runWithTenantContext(auth, () => lastValueFrom(next.handle()))
    );
  }
}
