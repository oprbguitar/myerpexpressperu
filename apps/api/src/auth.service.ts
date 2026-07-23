import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { createOpaqueToken, hashPassword, hashToken, verifyPassword } from "@erp/security";
import { DatabaseService } from "./database.service.js";
import { config } from "./config.js";

interface LoginUser {
  id: string;
  tenant_id: string;
  password_hash: string;
  status: string;
  failed_login_count: number;
  blocked_until: Date | null;
  force_password_change: boolean;
  full_name: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly database: DatabaseService) {}

  async login(email: string, password: string, request: FastifyRequest): Promise<{
    token: string;
    user: { id: string; fullName: string; forcePasswordChange: boolean };
  }> {
    const normalized = email.trim().toLowerCase();
    const [user] = await this.database.query<LoginUser>(
      `select u.id,u.tenant_id,u.password_hash,u.status,u.failed_login_count,u.blocked_until,
         u.force_password_change,coalesce(p.full_name,u.email::text) full_name
       from users u left join user_profiles p on p.user_id=u.id where u.normalized_email=$1`,
      [normalized]
    );
    const ip = request.ip;
    const agent = request.headers["user-agent"]?.slice(0, 500);
    const valid =
      user?.status === "active" &&
      (!user.blocked_until || user.blocked_until < new Date()) &&
      (await verifyPassword(user.password_hash, password));
    await this.database.query(
      `insert into login_attempts(tenant_id,normalized_email,success,ip_address,user_agent)
       values($1,$2,$3,$4,$5)`,
      [user?.tenant_id ?? null, normalized, valid, ip, agent]
    );
    if (!valid || !user) {
      if (user) {
        const nextCount = user.failed_login_count + 1;
        const blockedUntil =
          nextCount >= config.LOGIN_MAX_ATTEMPTS
            ? new Date(Date.now() + config.LOGIN_BLOCK_SECONDS * 1000)
            : null;
        await this.database.query(
          `update users set failed_login_count=$2,blocked_until=$3,updated_at=now(),version=version+1 where id=$1`,
          [user.id, nextCount, blockedUntil]
        );
      }
      throw new UnauthorizedException("Correo o contraseña incorrectos.");
    }
    const token = createOpaqueToken();
    await this.database.transaction(async (client) => {
      await client.query(
        `insert into sessions(tenant_id,user_id,token_hash,ip_address,user_agent,expires_at)
         values($1,$2,$3,$4,$5,now()+($6 || ' seconds')::interval)`,
        [user.tenant_id, user.id, hashToken(token, config.SESSION_SECRET), ip, agent, config.SESSION_TTL]
      );
      await client.query(
        `update users set failed_login_count=0,blocked_until=null,last_login_at=now(),updated_at=now() where id=$1`,
        [user.id]
      );
      await client.query(
        `insert into audit_events(tenant_id,actor_user_id,action,entity_type,entity_id,ip_address,user_agent,request_id)
         values($1,$2,'auth.login','user',$2,$3,$4,$5)`,
        [user.tenant_id, user.id, ip, agent, request.id]
      );
    });
    return { token, user: { id: user.id, fullName: user.full_name, forcePasswordChange: user.force_password_change } };
  }

  async logout(token: string | undefined, requestId: string): Promise<void> {
    if (!token) return;
    const tokenHash = hashToken(token, config.SESSION_SECRET);
    await this.database.query(
      `with revoked as (
         update sessions set revoked_at=now() where token_hash=$1 and revoked_at is null returning tenant_id,user_id
       ) insert into audit_events(tenant_id,actor_user_id,action,entity_type,entity_id,request_id)
         select tenant_id,user_id,'auth.logout','session',user_id,$2 from revoked`,
      [tokenHash, requestId]
    );
  }

  async requestPasswordReset(email: string): Promise<{ resetToken?: string }> {
    const [user] = await this.database.query<{ id: string; tenant_id: string }>(
      "select id,tenant_id from users where normalized_email=$1 and status='active'",
      [email.trim().toLowerCase()]
    );
    if (!user) return {};
    const token = createOpaqueToken();
    await this.database.query(
      `insert into password_reset_tokens(tenant_id,user_id,token_hash,expires_at)
       values($1,$2,$3,now()+($4 || ' seconds')::interval)`,
      [user.tenant_id, user.id, hashToken(token, config.SESSION_SECRET), config.PASSWORD_RESET_TTL]
    );
    return config.NODE_ENV === "development" ? { resetToken: token } : {};
  }

  async resetPassword(token: string, newPasswordHash: string): Promise<void> {
    const tokenHash = hashToken(token, config.SESSION_SECRET);
    const changed = await this.database.transaction(async (client) => {
      const result = await client.query<{ user_id: string; tenant_id: string }>(
        `update password_reset_tokens set used_at=now()
         where token_hash=$1 and used_at is null and expires_at>now() returning user_id,tenant_id`,
        [tokenHash]
      );
      const row = result.rows[0];
      if (!row) return false;
      await client.query(
        `update users set password_hash=$2,force_password_change=false,password_changed_at=now(),
         updated_at=now(),version=version+1 where id=$1`,
        [row.user_id, newPasswordHash]
      );
      await client.query("update sessions set revoked_at=now() where user_id=$1 and revoked_at is null", [row.user_id]);
      return true;
    });
    if (!changed) throw new UnauthorizedException("El enlace no es válido o ya venció.");
  }

  async changePassword(userId: string, currentPassword: string, password: string, currentSessionId: string): Promise<void> {
    const [user] = await this.database.query<{ password_hash: string }>("select password_hash from users where id=$1", [userId]);
    if (!user || !(await verifyPassword(user.password_hash, currentPassword))) {
      throw new UnauthorizedException("La contraseña actual no es correcta.");
    }
    const passwordHash = await hashPassword(password);
    await this.database.transaction(async (client) => {
      await client.query(
        `update users set password_hash=$2,force_password_change=false,password_changed_at=now(),
         updated_at=now(),version=version+1 where id=$1`,
        [userId, passwordHash]
      );
      await client.query("update sessions set revoked_at=now() where user_id=$1 and id<>$2 and revoked_at is null", [
        userId, currentSessionId
      ]);
    });
  }

  listSessions(userId: string) {
    return this.database.query(
      `select id,ip_address::text as "ipAddress",user_agent as "userAgent",created_at as "createdAt",
       last_seen_at as "lastSeenAt",expires_at as "expiresAt" from sessions
       where user_id=$1 and revoked_at is null and expires_at>now() order by last_seen_at desc`,
      [userId]
    );
  }
}
