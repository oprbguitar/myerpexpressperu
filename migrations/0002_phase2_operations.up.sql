-- SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
-- SPDX-License-Identifier: MPL-2.0
-- ERP Express Perú - Fase 2
-- Operaciones comerciales, inventario básico, caja y documentos.

create table payment_terms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  code text not null,
  name text not null,
  days integer not null default 0 check(days >= 0),
  installment_count integer not null default 1 check(installment_count > 0),
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id),
  version integer not null default 1 check(version > 0),
  unique(company_id, code)
);

create table parties (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  party_type text not null check(party_type in ('NATURAL_PERSON','LEGAL_ENTITY')),
  document_type text check(document_type in ('RUC','DNI','FOREIGN','NONE')),
  document_number text,
  normalized_document text,
  legal_name text,
  commercial_name text,
  first_name text,
  last_name text,
  normalized_name text not null,
  email citext,
  phone text,
  notes text,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id),
  version integer not null default 1 check(version > 0),
  check(
    (party_type='LEGAL_ENTITY' and legal_name is not null and char_length(trim(legal_name)) >= 2)
    or party_type='NATURAL_PERSON'
  ),
  check(document_type <> 'RUC' or document_number ~ '^[0-9]{11}$'),
  check(document_type <> 'DNI' or document_number ~ '^[0-9]{8}$')
);
create unique index parties_document_unique
  on parties(tenant_id, document_type, normalized_document)
  where normalized_document is not null and status <> 'deleted';
create index parties_company_status_name on parties(company_id, status, normalized_name, id);

create table party_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  party_id uuid not null references parties(id),
  role_code text not null check(role_code in ('CUSTOMER','SUPPLIER','TRANSPORT_PROVIDER','CONTACT')),
  status record_status not null default 'active',
  activated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  created_by uuid references users(id),
  unique(company_id, party_id, role_code)
);
create index party_roles_company_role on party_roles(company_id, role_code, status, party_id);

create table party_addresses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  party_id uuid not null references parties(id),
  address_type text not null default 'FISCAL',
  line1 text not null,
  line2 text,
  district text,
  province text,
  department text,
  ubigeo varchar(6) check(ubigeo is null or ubigeo ~ '^[0-9]{6}$'),
  is_primary boolean not null default false,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id),
  version integer not null default 1
);
create unique index party_primary_address_unique on party_addresses(party_id) where is_primary and status='active';
create index party_addresses_party on party_addresses(party_id, status);

create table party_contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  party_id uuid not null references parties(id),
  name text not null,
  position text,
  email citext,
  phone text,
  is_primary boolean not null default false,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id),
  version integer not null default 1
);
create index party_contacts_party on party_contacts(party_id, status);

create table customer_profiles (
  party_id uuid primary key references parties(id),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  payment_term_id uuid references payment_terms(id),
  credit_limit numeric(18,2) not null default 0 check(credit_limit >= 0),
  credit_currency char(3) not null default 'PEN',
  allow_credit boolean not null default false,
  price_list_id uuid,
  status record_status not null default 'active',
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id),
  version integer not null default 1
);

create table supplier_profiles (
  party_id uuid primary key references parties(id),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  payment_term_id uuid references payment_terms(id),
  withholding_notes text,
  status record_status not null default 'active',
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id),
  version integer not null default 1
);

create table item_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  parent_id uuid references item_categories(id),
  code text not null,
  name text not null,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id),
  version integer not null default 1,
  unique(company_id, code),
  check(parent_id is null or parent_id <> id)
);

create table units_of_measure (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  code text not null,
  name text not null,
  sunat_code text,
  allows_decimals boolean not null default true,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id),
  version integer not null default 1,
  unique(company_id, code)
);

create table tax_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  code text not null,
  name text not null,
  tax_category text not null check(tax_category in ('TAXABLE','EXEMPT','UNAFFECTED','FREE')),
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id),
  version integer not null default 1,
  unique(company_id, code)
);

create table tax_rates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  tax_profile_id uuid not null references tax_profiles(id),
  rate numeric(9,6) not null check(rate >= 0 and rate <= 1),
  effective_from date not null,
  effective_until date,
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  check(effective_until is null or effective_until >= effective_from),
  unique(tax_profile_id, effective_from)
);
create index tax_rates_effective on tax_rates(tax_profile_id, effective_from desc, effective_until);

create table items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  code text not null,
  name text not null,
  description text,
  item_type text not null check(item_type in ('PRODUCT','SERVICE','CONSUMABLE','RAW_MATERIAL','SPARE_PART','DIGITAL_PRODUCT')),
  category_id uuid references item_categories(id),
  unit_id uuid references units_of_measure(id),
  tax_profile_id uuid not null references tax_profiles(id),
  purchase_price numeric(18,6) not null default 0 check(purchase_price >= 0),
  sale_price numeric(18,6) not null default 0 check(sale_price >= 0),
  currency char(3) not null default 'PEN',
  manages_stock boolean not null default false,
  minimum_stock numeric(18,6) not null default 0 check(minimum_stock >= 0),
  image_document_id uuid references documents(id),
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id),
  version integer not null default 1,
  unique(company_id, code),
  check(not manages_stock or (item_type <> 'SERVICE' and unit_id is not null))
);
create index items_company_status_name on items(company_id, status, lower(name), id);

create table item_barcodes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  item_id uuid not null references items(id),
  barcode text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique(company_id, barcode)
);
create index item_barcodes_item on item_barcodes(item_id);

create table price_lists (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  code text not null,
  name text not null,
  currency char(3) not null default 'PEN',
  valid_from date not null,
  valid_until date,
  is_default boolean not null default false,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id),
  version integer not null default 1,
  check(valid_until is null or valid_until >= valid_from),
  unique(company_id, code)
);
create unique index price_lists_default_unique on price_lists(company_id, currency)
  where is_default and status='active';

create table price_list_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  price_list_id uuid not null references price_lists(id),
  item_id uuid not null references items(id),
  minimum_quantity numeric(18,6) not null default 1 check(minimum_quantity > 0),
  unit_price numeric(18,6) not null check(unit_price >= 0),
  maximum_discount_rate numeric(9,6) not null default 0 check(maximum_discount_rate between 0 and 1),
  valid_from date not null,
  valid_until date,
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  check(valid_until is null or valid_until >= valid_from),
  unique(price_list_id, item_id, minimum_quantity, valid_from)
);
create index price_list_items_resolve on price_list_items(price_list_id, item_id, minimum_quantity desc, valid_from desc);

create table customer_price_lists (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  customer_party_id uuid not null references parties(id),
  price_list_id uuid not null references price_lists(id),
  valid_from date not null,
  valid_until date,
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  check(valid_until is null or valid_until >= valid_from),
  unique(company_id, customer_party_id, price_list_id, valid_from)
);
alter table customer_profiles add constraint customer_profiles_price_list_fk
  foreign key(price_list_id) references price_lists(id);

create table warehouses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  branch_id uuid references branches(id),
  code text not null,
  name text not null,
  address text,
  allow_negative_stock boolean not null default false,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id),
  version integer not null default 1,
  unique(company_id, code)
);

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  branch_id uuid references branches(id),
  warehouse_id uuid not null references warehouses(id),
  linked_movement_id uuid references stock_movements(id),
  movement_type text not null check(movement_type in (
    'OPENING','PURCHASE_RECEIPT','SALE_ISSUE','TRANSFER_OUT','TRANSFER_IN',
    'CUSTOMER_RETURN','SUPPLIER_RETURN','POSITIVE_ADJUSTMENT','NEGATIVE_ADJUSTMENT'
  )),
  movement_date timestamptz not null default now(),
  source_entity_type text not null,
  source_entity_id uuid not null,
  reason text,
  status text not null default 'POSTED' check(status in ('POSTED','REVERSED')),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references users(id),
  unique(company_id, idempotency_key)
);
create index stock_movements_source on stock_movements(company_id, source_entity_type, source_entity_id);
create index stock_movements_warehouse_time on stock_movements(warehouse_id, movement_date desc, id);

create table stock_movement_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  stock_movement_id uuid not null references stock_movements(id),
  item_id uuid not null references items(id),
  quantity numeric(18,6) not null check(quantity > 0),
  unit_cost numeric(18,6) check(unit_cost is null or unit_cost >= 0),
  signed_quantity numeric(18,6) not null check(signed_quantity <> 0),
  created_at timestamptz not null default now()
);
create index stock_movement_lines_movement on stock_movement_lines(stock_movement_id);
create index stock_movement_lines_item on stock_movement_lines(item_id, stock_movement_id);

create table stock_balances (
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  warehouse_id uuid not null references warehouses(id),
  item_id uuid not null references items(id),
  quantity numeric(18,6) not null default 0,
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  primary key(warehouse_id, item_id)
);
create index stock_balances_company_item on stock_balances(company_id, item_id, warehouse_id);

create table stock_reservations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  warehouse_id uuid not null references warehouses(id),
  item_id uuid not null references items(id),
  source_entity_type text not null,
  source_entity_id uuid not null,
  quantity numeric(18,6) not null check(quantity > 0),
  expires_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references users(id)
);
create index stock_reservations_active on stock_reservations(warehouse_id, item_id, expires_at)
  where released_at is null;

create table quotations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  branch_id uuid references branches(id),
  customer_party_id uuid not null references parties(id),
  quotation_number text,
  issue_date date not null default current_date,
  valid_until date not null,
  currency char(3) not null default 'PEN',
  exchange_rate numeric(18,8) not null default 1 check(exchange_rate > 0),
  payment_term_id uuid references payment_terms(id),
  customer_snapshot jsonb not null,
  subtotal numeric(18,2) not null default 0,
  discount_total numeric(18,2) not null default 0,
  taxable_amount numeric(18,2) not null default 0,
  exempt_amount numeric(18,2) not null default 0,
  unaffected_amount numeric(18,2) not null default 0,
  igv_amount numeric(18,2) not null default 0,
  total numeric(18,2) not null default 0,
  notes text,
  status text not null default 'DRAFT' check(status in ('DRAFT','SENT','ACCEPTED','REJECTED','EXPIRED','CONVERTED','CANCELLED')),
  converted_sales_order_id uuid,
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id),
  version integer not null default 1
);
create index quotations_company_date_status on quotations(company_id, issue_date desc, status, id);

create table quotation_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  quotation_id uuid not null references quotations(id),
  line_number integer not null check(line_number > 0),
  item_id uuid not null references items(id),
  item_code_snapshot text not null,
  description_snapshot text not null,
  unit_snapshot text not null,
  quantity numeric(18,6) not null check(quantity > 0),
  unit_price numeric(18,6) not null check(unit_price >= 0),
  discount_rate numeric(9,6) not null default 0 check(discount_rate between 0 and 1),
  tax_category text not null check(tax_category in ('TAXABLE','EXEMPT','UNAFFECTED','FREE')),
  tax_rate numeric(9,6) not null default 0 check(tax_rate between 0 and 1),
  subtotal numeric(18,2) not null,
  discount_amount numeric(18,2) not null,
  tax_amount numeric(18,2) not null,
  total numeric(18,2) not null,
  unique(quotation_id, line_number)
);
create index quotation_lines_quotation on quotation_lines(quotation_id);

create table sales_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  branch_id uuid references branches(id),
  quotation_id uuid references quotations(id),
  customer_party_id uuid not null references parties(id),
  order_number text,
  order_date date not null default current_date,
  currency char(3) not null default 'PEN',
  exchange_rate numeric(18,8) not null default 1 check(exchange_rate > 0),
  customer_snapshot jsonb not null,
  subtotal numeric(18,2) not null default 0,
  discount_total numeric(18,2) not null default 0,
  igv_amount numeric(18,2) not null default 0,
  total numeric(18,2) not null default 0,
  status text not null default 'DRAFT' check(status in ('DRAFT','CONFIRMED','PARTIALLY_FULFILLED','FULFILLED','CANCELLED')),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id),
  version integer not null default 1
);
alter table quotations add constraint quotations_converted_order_fk foreign key(converted_sales_order_id) references sales_orders(id);
create index sales_orders_company_date_status on sales_orders(company_id, order_date desc, status, id);

create table sales_order_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  sales_order_id uuid not null references sales_orders(id),
  line_number integer not null check(line_number > 0),
  item_id uuid not null references items(id),
  item_code_snapshot text not null,
  description_snapshot text not null,
  unit_snapshot text not null,
  quantity numeric(18,6) not null check(quantity > 0),
  fulfilled_quantity numeric(18,6) not null default 0 check(fulfilled_quantity >= 0 and fulfilled_quantity <= quantity),
  unit_price numeric(18,6) not null check(unit_price >= 0),
  discount_rate numeric(9,6) not null default 0 check(discount_rate between 0 and 1),
  tax_category text not null,
  tax_rate numeric(9,6) not null,
  subtotal numeric(18,2) not null,
  discount_amount numeric(18,2) not null,
  tax_amount numeric(18,2) not null,
  total numeric(18,2) not null,
  unique(sales_order_id, line_number)
);
create index sales_order_lines_order on sales_order_lines(sales_order_id);

create table sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  branch_id uuid references branches(id),
  warehouse_id uuid references warehouses(id),
  sales_order_id uuid references sales_orders(id),
  customer_party_id uuid not null references parties(id),
  sale_number text,
  sale_date timestamptz not null default now(),
  currency char(3) not null default 'PEN',
  exchange_rate numeric(18,8) not null default 1 check(exchange_rate > 0),
  payment_condition text not null check(payment_condition in ('CASH','CREDIT')),
  due_date date,
  customer_snapshot jsonb not null,
  subtotal numeric(18,2) not null default 0,
  discount_total numeric(18,2) not null default 0,
  taxable_amount numeric(18,2) not null default 0,
  exempt_amount numeric(18,2) not null default 0,
  unaffected_amount numeric(18,2) not null default 0,
  igv_amount numeric(18,2) not null default 0,
  total numeric(18,2) not null default 0,
  paid_amount numeric(18,2) not null default 0 check(paid_amount >= 0),
  status text not null default 'DRAFT' check(status in ('DRAFT','CONFIRMED','PARTIALLY_PAID','PAID','CANCELLED')),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id),
  version integer not null default 1,
  check(payment_condition <> 'CREDIT' or due_date is not null),
  check(paid_amount <= total)
);
create index sales_company_date_status on sales(company_id, sale_date desc, status, id);

create table sale_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  sale_id uuid not null references sales(id),
  line_number integer not null check(line_number > 0),
  item_id uuid not null references items(id),
  item_code_snapshot text not null,
  description_snapshot text not null,
  unit_snapshot text not null,
  quantity numeric(18,6) not null check(quantity > 0),
  unit_price numeric(18,6) not null check(unit_price >= 0),
  discount_rate numeric(9,6) not null default 0,
  tax_category text not null,
  tax_rate numeric(9,6) not null,
  subtotal numeric(18,2) not null,
  discount_amount numeric(18,2) not null,
  tax_amount numeric(18,2) not null,
  total numeric(18,2) not null,
  stock_managed boolean not null default false,
  unique(sale_id, line_number)
);
create index sale_lines_sale on sale_lines(sale_id);

create table document_series (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  establishment_id uuid references establishments(id),
  document_type text not null check(document_type in ('INVOICE','SALES_RECEIPT','CREDIT_NOTE','DEBIT_NOTE','INTERNAL_SALE','QUOTATION','SALES_ORDER','PURCHASE')),
  series text not null,
  current_number bigint not null default 0 check(current_number >= 0),
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id),
  version integer not null default 1,
  unique(company_id, establishment_id, document_type, series)
);

create table commercial_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  branch_id uuid references branches(id),
  establishment_id uuid references establishments(id),
  sale_id uuid references sales(id),
  document_type text not null check(document_type in ('INVOICE','SALES_RECEIPT','CREDIT_NOTE','DEBIT_NOTE','INTERNAL_SALE')),
  series text,
  sequential_number bigint,
  issue_date timestamptz,
  customer_snapshot jsonb not null,
  customer_document text,
  customer_address text,
  currency char(3) not null default 'PEN',
  exchange_rate numeric(18,8) not null default 1,
  taxable_amount numeric(18,2) not null default 0,
  exempt_amount numeric(18,2) not null default 0,
  unaffected_amount numeric(18,2) not null default 0,
  igv_amount numeric(18,2) not null default 0,
  total numeric(18,2) not null default 0,
  payment_condition text,
  due_date date,
  related_document_id uuid references commercial_documents(id),
  sunat_provider text not null default 'MANUAL' check(sunat_provider in ('MANUAL','MOCK')),
  sunat_environment text not null default 'MANUAL' check(sunat_environment in ('MANUAL','DEMO','BETA','PRODUCTION')),
  status text not null default 'DRAFT' check(status in (
    'DRAFT','ISSUED','PENDING_SUBMISSION','ACCEPTED','ACCEPTED_WITH_OBSERVATIONS',
    'REJECTED','VOID_PENDING','VOIDED','FAILED','CANCELLED_INTERNAL'
  )),
  xml_document_id uuid references documents(id),
  pdf_document_id uuid references documents(id),
  cdr_document_id uuid references documents(id),
  content_hash text,
  external_reference text,
  response_code text,
  response_message text,
  submission_attempts integer not null default 0 check(submission_attempts >= 0),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id),
  version integer not null default 1,
  check((status='DRAFT' and sequential_number is null) or status='DRAFT' or (series is not null and sequential_number is not null))
);
create unique index commercial_documents_number_unique
  on commercial_documents(company_id, document_type, series, sequential_number)
  where sequential_number is not null;
create index commercial_documents_company_status on commercial_documents(company_id, status, issue_date desc, id);

create table commercial_document_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  commercial_document_id uuid not null references commercial_documents(id),
  line_number integer not null,
  item_id uuid references items(id),
  item_code_snapshot text,
  description_snapshot text not null,
  unit_snapshot text not null,
  quantity numeric(18,6) not null,
  unit_price numeric(18,6) not null,
  discount_amount numeric(18,2) not null default 0,
  tax_category text not null,
  tax_rate numeric(9,6) not null,
  tax_amount numeric(18,2) not null,
  total numeric(18,2) not null,
  unique(commercial_document_id, line_number)
);
create index commercial_document_lines_document on commercial_document_lines(commercial_document_id);

create table commercial_document_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  commercial_document_id uuid not null references commercial_documents(id),
  previous_status text,
  new_status text not null,
  comment text,
  metadata jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  actor_user_id uuid references users(id)
);
create index commercial_document_events_document on commercial_document_events(commercial_document_id, occurred_at);
create rule commercial_document_events_no_update as on update to commercial_document_events do instead nothing;
create rule commercial_document_events_no_delete as on delete to commercial_document_events do instead nothing;

create table electronic_submission_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  commercial_document_id uuid not null references commercial_documents(id),
  provider text not null,
  scenario text,
  request_hash text not null,
  external_reference text,
  result_status text not null,
  response_code text,
  response_message text,
  attempt_number integer not null,
  created_at timestamptz not null default now(),
  unique(commercial_document_id, attempt_number)
);

create table purchases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  branch_id uuid references branches(id),
  warehouse_id uuid references warehouses(id),
  supplier_party_id uuid not null references parties(id),
  purchase_number text,
  purchase_date date not null default current_date,
  issue_date date not null,
  due_date date,
  currency char(3) not null default 'PEN',
  exchange_rate numeric(18,8) not null default 1 check(exchange_rate > 0),
  payment_condition text not null check(payment_condition in ('CASH','CREDIT')),
  supplier_snapshot jsonb not null,
  subtotal numeric(18,2) not null default 0,
  taxable_amount numeric(18,2) not null default 0,
  exempt_amount numeric(18,2) not null default 0,
  unaffected_amount numeric(18,2) not null default 0,
  igv_amount numeric(18,2) not null default 0,
  total numeric(18,2) not null default 0,
  paid_amount numeric(18,2) not null default 0,
  status text not null default 'DRAFT' check(status in ('DRAFT','CONFIRMED','PARTIALLY_PAID','PAID','CANCELLED')),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id),
  version integer not null default 1,
  check(payment_condition <> 'CREDIT' or due_date is not null),
  check(paid_amount between 0 and total)
);
create index purchases_company_date_status on purchases(company_id, purchase_date desc, status, id);

create table purchase_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  purchase_id uuid not null references purchases(id),
  line_number integer not null,
  item_id uuid not null references items(id),
  item_code_snapshot text not null,
  description_snapshot text not null,
  unit_snapshot text not null,
  quantity numeric(18,6) not null check(quantity > 0),
  unit_cost numeric(18,6) not null check(unit_cost >= 0),
  tax_category text not null,
  tax_rate numeric(9,6) not null,
  tax_amount numeric(18,2) not null,
  total numeric(18,2) not null,
  stock_managed boolean not null default false,
  unique(purchase_id, line_number)
);
create index purchase_lines_purchase on purchase_lines(purchase_id);

create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  code text not null,
  name text not null,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id),
  version integer not null default 1,
  unique(company_id, code)
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  branch_id uuid references branches(id),
  cost_center_id uuid references cost_centers(id),
  supplier_party_id uuid references parties(id),
  category_id uuid not null references expense_categories(id),
  description text not null,
  expense_date date not null default current_date,
  currency char(3) not null default 'PEN',
  exchange_rate numeric(18,8) not null default 1,
  amount numeric(18,2) not null check(amount >= 0),
  tax_amount numeric(18,2) not null default 0 check(tax_amount >= 0),
  total numeric(18,2) not null check(total >= 0),
  payment_condition text not null check(payment_condition in ('CASH','CREDIT')),
  due_date date,
  payment_method text,
  receipt_document_id uuid references documents(id),
  status text not null default 'DRAFT' check(status in ('DRAFT','REGISTERED','PARTIALLY_PAID','PAID','CANCELLED')),
  registered_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id),
  version integer not null default 1,
  check(payment_condition <> 'CREDIT' or due_date is not null)
);
create index expenses_company_date_status on expenses(company_id, expense_date desc, status, id);

create table supplier_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  supplier_party_id uuid not null references parties(id),
  purchase_id uuid references purchases(id),
  expense_id uuid references expenses(id),
  document_type text not null,
  series text not null,
  number text not null,
  issue_date date not null,
  amount numeric(18,2) not null check(amount >= 0),
  currency char(3) not null default 'PEN',
  document_id uuid references documents(id),
  duplicate_override_token text not null default '',
  duplicate_override_reason text,
  duplicate_override_by uuid references users(id),
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  unique(company_id, supplier_party_id, document_type, series, number, duplicate_override_token)
);
create index supplier_documents_duplicate_lookup
  on supplier_documents(company_id, supplier_party_id, document_type, series, number, issue_date, amount);

create table accounts_receivable (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  customer_party_id uuid not null references parties(id),
  sale_id uuid not null unique references sales(id),
  commercial_document_id uuid references commercial_documents(id),
  currency char(3) not null,
  principal numeric(18,2) not null check(principal >= 0),
  applied_amount numeric(18,2) not null default 0 check(applied_amount >= 0),
  outstanding_amount numeric(18,2) not null check(outstanding_amount >= 0),
  due_date date not null,
  status text not null default 'OPEN' check(status in ('OPEN','PARTIALLY_PAID','PAID','OVERDUE','CANCELLED')),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id),
  version integer not null default 1,
  check(applied_amount + outstanding_amount = principal)
);
create index receivables_customer_status_due on accounts_receivable(company_id, customer_party_id, status, due_date, id);
create index receivables_open_due on accounts_receivable(company_id, due_date, id)
  where status in ('OPEN','PARTIALLY_PAID','OVERDUE');

create table receivable_installments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  receivable_id uuid not null references accounts_receivable(id),
  installment_number integer not null check(installment_number > 0),
  due_date date not null,
  amount numeric(18,2) not null check(amount > 0),
  applied_amount numeric(18,2) not null default 0 check(applied_amount >= 0 and applied_amount <= amount),
  status text not null default 'OPEN' check(status in ('OPEN','PARTIALLY_PAID','PAID','OVERDUE','CANCELLED')),
  unique(receivable_id, installment_number)
);

create table accounts_payable (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  supplier_party_id uuid references parties(id),
  purchase_id uuid unique references purchases(id),
  expense_id uuid unique references expenses(id),
  currency char(3) not null,
  principal numeric(18,2) not null check(principal >= 0),
  applied_amount numeric(18,2) not null default 0 check(applied_amount >= 0),
  outstanding_amount numeric(18,2) not null check(outstanding_amount >= 0),
  due_date date not null,
  status text not null default 'OPEN' check(status in ('OPEN','PARTIALLY_PAID','PAID','OVERDUE','CANCELLED')),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id),
  version integer not null default 1,
  check((purchase_id is not null)::integer + (expense_id is not null)::integer = 1),
  check(applied_amount + outstanding_amount = principal)
);
create index payables_supplier_status_due on accounts_payable(company_id, supplier_party_id, status, due_date, id);
create index payables_open_due on accounts_payable(company_id, due_date, id)
  where status in ('OPEN','PARTIALLY_PAID','OVERDUE');

create table payable_installments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  payable_id uuid not null references accounts_payable(id),
  installment_number integer not null check(installment_number > 0),
  due_date date not null,
  amount numeric(18,2) not null check(amount > 0),
  applied_amount numeric(18,2) not null default 0 check(applied_amount >= 0 and applied_amount <= amount),
  status text not null default 'OPEN' check(status in ('OPEN','PARTIALLY_PAID','PAID','OVERDUE','CANCELLED')),
  unique(payable_id, installment_number)
);

create table cash_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  branch_id uuid references branches(id),
  code text not null,
  name text not null,
  currency char(3) not null default 'PEN',
  account_type text not null default 'CASH' check(account_type in ('CASH','BANK','DIGITAL_WALLET')),
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id),
  version integer not null default 1,
  unique(company_id, code)
);

create table cash_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  branch_id uuid references branches(id),
  cash_account_id uuid not null references cash_accounts(id),
  user_id uuid not null references users(id),
  opened_at timestamptz not null default now(),
  opening_balance numeric(18,2) not null default 0,
  closed_at timestamptz,
  expected_balance numeric(18,2),
  counted_balance numeric(18,2),
  difference numeric(18,2),
  difference_reason text,
  status text not null default 'OPEN' check(status in ('OPEN','CLOSED','CANCELLED')),
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id),
  version integer not null default 1,
  check(status <> 'CLOSED' or (closed_at is not null and expected_balance is not null and counted_balance is not null and difference is not null)),
  check(difference is null or difference = 0 or nullif(trim(difference_reason),'') is not null)
);
create unique index cash_sessions_one_open on cash_sessions(company_id, cash_account_id, user_id)
  where status='OPEN';
create index cash_sessions_company_status on cash_sessions(company_id, status, opened_at desc, id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  branch_id uuid references branches(id),
  direction text not null check(direction in ('INBOUND','OUTBOUND')),
  payment_method text not null check(payment_method in ('CASH','BANK_TRANSFER','CARD','DIGITAL_WALLET','CHECK','OTHER')),
  currency char(3) not null,
  exchange_rate numeric(18,8) not null default 1 check(exchange_rate > 0),
  amount numeric(18,2) not null check(amount > 0),
  payment_date timestamptz not null default now(),
  party_id uuid references parties(id),
  cash_account_id uuid references cash_accounts(id),
  cash_session_id uuid references cash_sessions(id),
  reference text,
  notes text,
  status text not null default 'POSTED' check(status in ('POSTED','REVERSED')),
  reversed_payment_id uuid references payments(id),
  reversal_reason text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references users(id),
  unique(company_id, idempotency_key)
);
create index payments_company_date on payments(company_id, payment_date desc, id);

create table payment_applications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  payment_id uuid not null references payments(id),
  receivable_id uuid references accounts_receivable(id),
  payable_id uuid references accounts_payable(id),
  amount numeric(18,2) not null check(amount > 0),
  is_reversal boolean not null default false,
  reverses_application_id uuid references payment_applications(id),
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  check((receivable_id is not null)::integer + (payable_id is not null)::integer = 1)
);
create index payment_applications_payment on payment_applications(payment_id);
create index payment_applications_receivable on payment_applications(receivable_id) where receivable_id is not null;
create index payment_applications_payable on payment_applications(payable_id) where payable_id is not null;

create table cash_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  cash_account_id uuid not null references cash_accounts(id),
  cash_session_id uuid references cash_sessions(id),
  payment_id uuid references payments(id),
  movement_type text not null check(movement_type in ('OPENING','INCOME','EXPENSE','TRANSFER_IN','TRANSFER_OUT','REVERSAL','DIFFERENCE')),
  signed_amount numeric(18,2) not null check(signed_amount <> 0),
  currency char(3) not null,
  source_entity_type text not null,
  source_entity_id uuid not null,
  description text not null,
  occurred_at timestamptz not null default now(),
  created_by uuid references users(id)
);
create index cash_movements_account_time on cash_movements(cash_account_id, occurred_at desc, id);
create rule cash_movements_no_update as on update to cash_movements do instead nothing;
create rule cash_movements_no_delete as on delete to cash_movements do instead nothing;

create table bank_account_references (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  cash_account_id uuid not null references cash_accounts(id),
  bank_name text not null,
  masked_account_number text not null,
  cci_masked text,
  currency char(3) not null,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid references users(id)
);

create table currencies (
  code char(3) primary key,
  name text not null,
  symbol text not null,
  decimal_places integer not null default 2 check(decimal_places between 0 and 6),
  status record_status not null default 'active'
);

create table exchange_rates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  rate_date date not null,
  source_currency char(3) not null references currencies(code),
  target_currency char(3) not null references currencies(code),
  buy_rate numeric(18,8) not null check(buy_rate > 0),
  sell_rate numeric(18,8) not null check(sell_rate > 0),
  source text not null default 'MANUAL',
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  unique(company_id, rate_date, source_currency, target_currency, source)
);

create table import_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  import_type text not null check(import_type in ('CUSTOMERS','SUPPLIERS','PRODUCTS','SERVICES','OPENING_STOCK','PRICE_LISTS')),
  original_document_id uuid references documents(id),
  status text not null default 'PREVIEWED' check(status in ('PARSING','PREVIEWED','VALIDATED','EXECUTING','COMPLETED','FAILED')),
  headers jsonb not null default '[]',
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  invalid_rows integer not null default 0,
  executed_rows integer not null default 0,
  idempotency_key text,
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  completed_at timestamptz,
  unique(company_id, idempotency_key)
);
create index import_jobs_company_time on import_jobs(company_id, created_at desc, id);

create table import_job_rows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  import_job_id uuid not null references import_jobs(id),
  row_number integer not null check(row_number > 0),
  normalized_data jsonb not null,
  errors jsonb not null default '[]',
  status text not null check(status in ('VALID','INVALID','IMPORTED','FAILED')),
  created_entity_id uuid,
  unique(import_job_id, row_number)
);
create index import_job_rows_job_status on import_job_rows(import_job_id, status, row_number);

create table export_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  export_type text not null,
  filters jsonb not null default '{}',
  status text not null default 'COMPLETED' check(status in ('PENDING','PROCESSING','COMPLETED','FAILED')),
  row_count integer not null default 0,
  document_id uuid references documents(id),
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  completed_at timestamptz
);

create table idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  user_id uuid not null references users(id),
  operation text not null,
  idempotency_key text not null,
  request_hash char(64) not null,
  response_reference jsonb,
  status text not null default 'PROCESSING' check(status in ('PROCESSING','COMPLETED','FAILED')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  unique(tenant_id, company_id, user_id, operation, idempotency_key)
);
create index idempotency_keys_expiration on idempotency_keys(expires_at);

create table outbox_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  aggregate_type text not null,
  aggregate_id uuid not null,
  event_type text not null,
  payload jsonb not null,
  occurred_at timestamptz not null default now(),
  available_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts integer not null default 0,
  last_error text
);
create index outbox_events_pending on outbox_events(available_at, id) where processed_at is null;

create table notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  user_id uuid references users(id),
  notification_type text not null,
  title text not null,
  message text not null,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_unread on notifications(company_id, user_id, created_at desc) where read_at is null;

create table notification_preferences (
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  user_id uuid not null references users(id),
  notification_type text not null,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(user_id, notification_type)
);

-- RLS de defensa en profundidad. La cuenta propietaria de migraciones puede
-- omitir RLS; la cuenta de runtime deberá usar SET LOCAL app.* por transacción.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'payment_terms','parties','party_roles','party_addresses','party_contacts',
    'customer_profiles','supplier_profiles','item_categories','units_of_measure',
    'tax_profiles','tax_rates','items','item_barcodes','price_lists','price_list_items',
    'customer_price_lists','warehouses','stock_movements','stock_movement_lines',
    'stock_balances','stock_reservations','quotations','quotation_lines','sales_orders',
    'sales_order_lines','sales','sale_lines','document_series','commercial_documents',
    'commercial_document_lines','commercial_document_events','electronic_submission_attempts',
    'purchases','purchase_lines','expense_categories','expenses','supplier_documents',
    'accounts_receivable','receivable_installments','accounts_payable','payable_installments',
    'cash_accounts','cash_sessions','payments','payment_applications','cash_movements',
    'bank_account_references','exchange_rates','import_jobs','import_job_rows','export_jobs',
    'idempotency_keys','outbox_events','notifications','notification_preferences'
  ] loop
    execute format('alter table %I enable row level security', table_name);
    execute format(
      'create policy %I on %I using(tenant_id=app_tenant_id() and company_id=app_company_id()) with check(tenant_id=app_tenant_id() and company_id=app_company_id())',
      table_name || '_company_isolation', table_name
    );
  end loop;
end $$;
