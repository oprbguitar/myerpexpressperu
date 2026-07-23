import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthenticatedContext } from "@erp/contracts";
import { hashToken } from "@erp/security";
import { DatabaseService } from "./database.service.js";
import { config } from "./config.js";
import type { ApiRequest } from "./http.js";

const permissionMetadata = "required-permissions";
const moduleMetadata = "required-module";
export const RequirePermissions = (...permissions: string[]): MethodDecorator =>
  SetMetadata(permissionMetadata, permissions);
export const RequireModule = (moduleCode: string): MethodDecorator =>
  SetMetadata(moduleMetadata, moduleCode);
export const PublicRoute = (): MethodDecorator => SetMetadata("public-route", true);

interface ContextRow {
  session_id: string; user_id: string; tenant_id: string; company_id: string;
  branch_ids: string[]; permissions: string[]; force_password_change: boolean;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly database: DatabaseService,
    private readonly reflector: Reflector
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>("public-route", [context.getHandler(), context.getClass()]);
    if (isPublic) return true;
    const request = context.switchToHttp().getRequest<ApiRequest>();
    const token = request.cookies.erp_session;
    if (!token) throw new UnauthorizedException();
    const [row] = await this.database.query<ContextRow>(
      `select s.id session_id,u.id user_id,u.tenant_id,uc.company_id,u.force_password_change,
        coalesce(array_agg(distinct ub.branch_id) filter(where ub.branch_id is not null),'{}') branch_ids,
        coalesce(array_agg(distinct p.code) filter(where p.code is not null),'{}') permissions
       from sessions s join users u on u.id=s.user_id
       join user_companies uc on uc.user_id=u.id and uc.is_default
       left join user_branches ub on ub.user_id=u.id and ub.company_id=uc.company_id
       left join user_roles ur on ur.user_id=u.id and ur.company_id=uc.company_id
       left join role_permissions rp on rp.role_id=ur.role_id
       left join permissions p on p.id=rp.permission_id
       where s.token_hash=$1 and s.revoked_at is null and s.expires_at>now() and u.status='active'
       group by s.id,u.id,u.tenant_id,uc.company_id,u.force_password_change`,
      [hashToken(token, config.SESSION_SECRET)]
    );
    if (!row) throw new UnauthorizedException();
    const auth: AuthenticatedContext = {
      userId: row.user_id, tenantId: row.tenant_id, companyId: row.company_id,
      branchIds: row.branch_ids, permissions: new Set(row.permissions), sessionId: row.session_id,
      forcePasswordChange: row.force_password_change
    };
    request.auth = auth;
    const passwordChangeAllowed =
      request.url.endsWith("/me") ||
      request.url.endsWith("/auth/change-password") ||
      request.url.endsWith("/auth/logout");
    if (row.force_password_change && !passwordChangeAllowed) {
      throw new ForbiddenException("Debe cambiar su contraseña antes de continuar.");
    }
    await this.database.query("update sessions set last_seen_at=now() where id=$1", [auth.sessionId]);
    const required = this.reflector.getAllAndOverride<string[]>(permissionMetadata, [context.getHandler(), context.getClass()]) ?? [];
    if (required.some((permission) => !auth.permissions.has(permission))) {
      throw new ForbiddenException("No tiene permiso para realizar esta operación.");
    }
    const requiredModule = this.reflector.getAllAndOverride<string>(moduleMetadata, [
      context.getHandler(), context.getClass()
    ]);
    if (requiredModule) {
      const [enabled] = await this.database.query<{ enabled: boolean }>(
        `select exists(
           select 1 from company_modules cm join modules m on m.id=cm.module_id
           where cm.tenant_id=$1 and cm.company_id=$2 and m.code=$3 and m.implemented
             and cm.status='enabled'
         ) enabled`,
        [auth.tenantId, auth.companyId, requiredModule]
      );
      if (!enabled?.enabled) throw new ForbiddenException("El módulo requerido está deshabilitado.");
    }
    return true;
  }
}
