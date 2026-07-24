/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { ConflictException, Injectable } from "@nestjs/common";
import { randomBytes, randomUUID } from "node:crypto";
import { EmailAddress } from "@erp/domain";
import { hashPassword } from "@erp/security";
import { DatabaseService } from "./database.service.js";
import type { ApiRequest } from "./http.js";

@Injectable()
export class UsersService {
  constructor(private readonly database: DatabaseService) {}
  list(request: ApiRequest, page: number, pageSize: number) {
    return this.database.query(
      `select u.id,u.email::text,p.full_name as "fullName",u.status,u.force_password_change as "forcePasswordChange",
       u.last_login_at as "lastLoginAt",u.created_at as "createdAt"
       from users u join user_companies uc on uc.user_id=u.id and uc.company_id=$2
       left join user_profiles p on p.user_id=u.id where u.tenant_id=$1
       order by p.full_name nulls last limit $3 offset $4`,
      [request.auth!.tenantId, request.auth!.companyId, pageSize, (page - 1) * pageSize]
    );
  }
  async create(request: ApiRequest, input: { email: string; fullName: string; roleIds: string[] }) {
    const email = EmailAddress.create(input.email).toString();
    const temporaryPassword = `${randomBytes(12).toString("base64url")}aA1!`;
    const passwordHash = await hashPassword(temporaryPassword);
    try {
      const created = await this.database.transaction(async (client) => {
        const userId = randomUUID();
        await client.query(
          `insert into users(id,tenant_id,email,password_hash,force_password_change,status,created_by)
           values($1,$2,$3,$4,true,'active',$5)`,
          [userId, request.auth!.tenantId, email, passwordHash, request.auth!.userId]
        );
        await client.query("insert into user_profiles(user_id,full_name) values($1,$2)", [userId, input.fullName.trim()]);
        await client.query(
          `insert into user_companies(user_id,tenant_id,company_id,is_default) values($1,$2,$3,true)`,
          [userId, request.auth!.tenantId, request.auth!.companyId]
        );
        for (const roleId of input.roleIds) {
          await client.query(
            `insert into user_roles(user_id,tenant_id,company_id,role_id,assigned_by)
             select $1,$2,$3,id,$4 from roles where id=$5 and tenant_id=$2 and (company_id=$3 or company_id is null)`,
            [userId, request.auth!.tenantId, request.auth!.companyId, request.auth!.userId, roleId]
          );
        }
        await client.query(
          `insert into audit_events(tenant_id,company_id,actor_user_id,action,entity_type,entity_id,new_values,request_id)
           values($1,$2,$3,'user.created','user',$4,jsonb_build_object('email',$5::text),$6)`,
          [request.auth!.tenantId, request.auth!.companyId, request.auth!.userId, userId, email, request.requestId]
        );
        return { id: userId, email, fullName: input.fullName, temporaryPassword };
      });
      return created;
    } catch (error) {
      if (String(error).includes("users_tenant_id_normalized_email")) throw new ConflictException("El correo ya está registrado.");
      throw error;
    }
  }
  async deactivate(request: ApiRequest, userId: string) {
    if (userId === request.auth!.userId) throw new ConflictException("No puede desactivar su propia cuenta.");
    const [adminCount] = await this.database.query<{ count: string }>(
      `select count(distinct ur.user_id)::text count from user_roles ur join roles r on r.id=ur.role_id
       join users u on u.id=ur.user_id where ur.company_id=$1 and r.code='company-admin' and u.status='active'`,
      [request.auth!.companyId]
    );
    const [target] = await this.database.query<{ is_admin: boolean }>(
      `select exists(select 1 from user_roles ur join roles r on r.id=ur.role_id
       where ur.user_id=$1 and ur.company_id=$2 and r.code='company-admin') is_admin`,
      [userId, request.auth!.companyId]
    );
    if (target?.is_admin && Number(adminCount?.count ?? 0) <= 1) {
      throw new ConflictException("No se puede desactivar al último administrador activo.");
    }
    await this.database.transaction(async (client) => {
      await client.query(
        `update users set status='inactive',updated_by=$3,updated_at=now(),version=version+1
         where id=$1 and tenant_id=$2`,
        [userId, request.auth!.tenantId, request.auth!.userId]
      );
      await client.query("update sessions set revoked_at=now() where user_id=$1 and revoked_at is null", [userId]);
      await client.query(
        `insert into audit_events(tenant_id,company_id,actor_user_id,action,entity_type,entity_id,request_id)
         values($1,$2,$3,'user.deactivated','user',$4,$5)`,
        [request.auth!.tenantId, request.auth!.companyId, request.auth!.userId, userId, request.requestId]
      );
    });
    return { success: true };
  }
}
