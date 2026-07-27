-- SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
-- SPDX-License-Identifier: MPL-2.0
--
-- Gestión operativa y trazabilidad del ciclo de vida de residuos.
-- El runner de migraciones aplica este archivo dentro de una transacción.

create table waste_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  branch_id uuid,
  source text not null
    check(char_length(trim(source)) between 1 and 200),
  description text not null
    check(char_length(trim(description)) between 1 and 500),
  quantity numeric(18,6) not null
    check(quantity > 0),
  unit text not null
    check(
      char_length(trim(unit)) between 1 and 30
      and unit = upper(trim(unit))
    ),
  hazardous boolean not null,
  current_phase text not null default 'GENERATION'
    check(current_phase in (
      'GENERATION',
      'CLASSIFICATION',
      'SEGREGATION',
      'INITIAL_STORAGE',
      'INTERNAL_TRANSFER',
      'CENTRAL_STORAGE',
      'DISPATCH',
      'FINAL_DESTINATION',
      'DOCUMENTARY_CLOSURE'
    )),
  status text not null default 'ACTIVE'
    check(status in ('ACTIVE','CLOSED')),
  generated_at timestamptz not null,
  assigned_to uuid references users(id),
  closing_document_id uuid,
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id),
  version integer not null default 1 check(version > 0),
  constraint waste_records_scope_unique
    unique(id,tenant_id,company_id),
  constraint waste_records_branch_scope_fk
    foreign key(branch_id,company_id,tenant_id)
    references branches(id,company_id,tenant_id),
  constraint waste_records_closing_document_scope_fk
    foreign key(closing_document_id,tenant_id,company_id)
    references documents(id,tenant_id,company_id),
  constraint waste_records_closure_consistency
    check(
      (
        status = 'ACTIVE'
        and current_phase <> 'DOCUMENTARY_CLOSURE'
      )
      or
      (
        status = 'CLOSED'
        and current_phase = 'DOCUMENTARY_CLOSURE'
        and closing_document_id is not null
      )
    )
);

create table waste_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  waste_record_id uuid not null,
  from_phase text
    check(from_phase is null or from_phase in (
      'GENERATION',
      'CLASSIFICATION',
      'SEGREGATION',
      'INITIAL_STORAGE',
      'INTERNAL_TRANSFER',
      'CENTRAL_STORAGE',
      'DISPATCH',
      'FINAL_DESTINATION',
      'DOCUMENTARY_CLOSURE'
    )),
  to_phase text not null
    check(to_phase in (
      'GENERATION',
      'CLASSIFICATION',
      'SEGREGATION',
      'INITIAL_STORAGE',
      'INTERNAL_TRANSFER',
      'CENTRAL_STORAGE',
      'DISPATCH',
      'FINAL_DESTINATION',
      'DOCUMENTARY_CLOSURE'
    )),
  occurred_at timestamptz not null default now(),
  responsible_user_id uuid references users(id),
  evidence_document_id uuid,
  notes text
    check(notes is null or char_length(trim(notes)) between 1 and 1000),
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  version integer not null default 1 check(version > 0),
  constraint waste_lifecycle_events_record_scope_fk
    foreign key(waste_record_id,tenant_id,company_id)
    references waste_records(id,tenant_id,company_id),
  constraint waste_lifecycle_events_evidence_scope_fk
    foreign key(evidence_document_id,tenant_id,company_id)
    references documents(id,tenant_id,company_id),
  constraint waste_lifecycle_events_transition_check
    check(
      (from_phase is null and to_phase = 'GENERATION')
      or (from_phase = 'GENERATION' and to_phase = 'CLASSIFICATION')
      or (from_phase = 'CLASSIFICATION' and to_phase = 'SEGREGATION')
      or (from_phase = 'SEGREGATION' and to_phase = 'INITIAL_STORAGE')
      or (from_phase = 'INITIAL_STORAGE' and to_phase = 'INTERNAL_TRANSFER')
      or (from_phase = 'INTERNAL_TRANSFER' and to_phase = 'CENTRAL_STORAGE')
      or (from_phase = 'CENTRAL_STORAGE' and to_phase = 'DISPATCH')
      or (from_phase = 'DISPATCH' and to_phase = 'FINAL_DESTINATION')
      or (
        from_phase = 'FINAL_DESTINATION'
        and to_phase = 'DOCUMENTARY_CLOSURE'
        and evidence_document_id is not null
      )
    )
);

create table waste_exceptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  waste_record_id uuid not null,
  severity text not null
    check(severity in ('LOW','MEDIUM','HIGH','CRITICAL')),
  exception_type text not null
    check(exception_type in (
      'INCORRECT_SEGREGATION',
      'MIXED_WASTE',
      'CONTAINER_OVERFLOW',
      'DAMAGED_CONTAINER',
      'MISSING_LABEL',
      'MISSING_DESTINATION_EVIDENCE',
      'QUANTITY_DIFFERENCE',
      'EXPIRED_AUTHORIZATION',
      'OVERDUE_CORRECTIVE_ACTION',
      'MISSING_SUBMISSION_DOCUMENTATION',
      'BLOCKED_WORKFLOW',
      'OTHER'
    )),
  description text not null
    check(char_length(trim(description)) between 3 and 1000),
  immediate_action text
    check(
      immediate_action is null
      or char_length(trim(immediate_action)) between 1 and 1000
    ),
  corrective_action text
    check(
      corrective_action is null
      or char_length(trim(corrective_action)) between 1 and 1000
    ),
  responsible_user_id uuid references users(id),
  due_date date,
  status text not null default 'OPEN'
    check(status in (
      'OPEN',
      'IN_PROGRESS',
      'VERIFICATION_PENDING',
      'CLOSED',
      'CANCELLED'
    )),
  closure_verification text
    check(
      closure_verification is null
      or char_length(trim(closure_verification)) between 1 and 2000
    ),
  evidence_document_id uuid,
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id),
  version integer not null default 1 check(version > 0),
  constraint waste_exceptions_record_scope_fk
    foreign key(waste_record_id,tenant_id,company_id)
    references waste_records(id,tenant_id,company_id),
  constraint waste_exceptions_evidence_scope_fk
    foreign key(evidence_document_id,tenant_id,company_id)
    references documents(id,tenant_id,company_id)
);

create index waste_records_scope_phase_time
  on waste_records(tenant_id,company_id,current_phase,generated_at desc,id desc);
create index waste_records_scope_status_time
  on waste_records(tenant_id,company_id,status,created_at);
create index waste_lifecycle_events_scope_record_time
  on waste_lifecycle_events(
    tenant_id,
    company_id,
    waste_record_id,
    occurred_at,
    id
  );
create index waste_exceptions_scope_queue
  on waste_exceptions(
    tenant_id,
    company_id,
    status,
    severity,
    due_date,
    created_at
  );
create index waste_exceptions_scope_record_time
  on waste_exceptions(
    tenant_id,
    company_id,
    waste_record_id,
    created_at desc
  );

alter table waste_records enable row level security;
alter table waste_records force row level security;
create policy waste_records_company_isolation on waste_records
  using(
    tenant_id = app_tenant_id()
    and company_id = app_company_id()
  )
  with check(
    tenant_id = app_tenant_id()
    and company_id = app_company_id()
  );

alter table waste_lifecycle_events enable row level security;
alter table waste_lifecycle_events force row level security;
create policy waste_lifecycle_events_company_isolation
  on waste_lifecycle_events
  using(
    tenant_id = app_tenant_id()
    and company_id = app_company_id()
  )
  with check(
    tenant_id = app_tenant_id()
    and company_id = app_company_id()
  );

alter table waste_exceptions enable row level security;
alter table waste_exceptions force row level security;
create policy waste_exceptions_company_isolation on waste_exceptions
  using(
    tenant_id = app_tenant_id()
    and company_id = app_company_id()
  )
  with check(
    tenant_id = app_tenant_id()
    and company_id = app_company_id()
  );

grant select, insert, update, delete
  on waste_records, waste_lifecycle_events, waste_exceptions
  to erp_app;
