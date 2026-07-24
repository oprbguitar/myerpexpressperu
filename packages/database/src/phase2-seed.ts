/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import type { PoolClient } from "pg";

interface SeedContext {
  tenantId: string;
  companyId: string;
  branchId: string;
  userId: string;
}

const ids = {
  branch2: "10000000-0000-4000-8000-000000000001",
  establishment: "10000000-0000-4000-8000-000000000002",
  cashTerm: "10000000-0000-4000-8000-000000000003",
  creditTerm: "10000000-0000-4000-8000-000000000004",
  unit: "10000000-0000-4000-8000-000000000005",
  serviceUnit: "10000000-0000-4000-8000-000000000006",
  taxable: "10000000-0000-4000-8000-000000000007",
  exempt: "10000000-0000-4000-8000-000000000008",
  productCategory: "10000000-0000-4000-8000-000000000009",
  serviceCategory: "10000000-0000-4000-8000-000000000010",
  customer: "10000000-0000-4000-8000-000000000011",
  supplier: "10000000-0000-4000-8000-000000000012",
  customer2: "10000000-0000-4000-8000-000000000013",
  product: "10000000-0000-4000-8000-000000000014",
  service: "10000000-0000-4000-8000-000000000015",
  consumable: "10000000-0000-4000-8000-000000000016",
  priceList: "10000000-0000-4000-8000-000000000017",
  warehouse: "10000000-0000-4000-8000-000000000018",
  cashAccount: "10000000-0000-4000-8000-000000000019",
  bankAccount: "10000000-0000-4000-8000-000000000020",
  expenseCategory: "10000000-0000-4000-8000-000000000021",
  quotation: "10000000-0000-4000-8000-000000000022",
  sale: "10000000-0000-4000-8000-000000000023",
  receivable: "10000000-0000-4000-8000-000000000024",
  purchase: "10000000-0000-4000-8000-000000000025",
  payable: "10000000-0000-4000-8000-000000000026",
  stockOpening: "10000000-0000-4000-8000-000000000027"
} as const;

export async function seedPhase2DemonstrationData(client: PoolClient, context: SeedContext): Promise<void> {
  const { tenantId, companyId, branchId, userId } = context;
  await client.query(
    `insert into branches(id,tenant_id,company_id,code,name,address,ubigeo,is_default)
     values($1,$2,$3,'ALMACEN-LIMA','Almacén Lima','Av. Argentina 2450, Callao','070101',false)
     on conflict(id) do update set name=excluded.name`,
    [ids.branch2, tenantId, companyId]
  );
  await client.query(
    `insert into establishments(id,tenant_id,company_id,branch_id,sunat_code,name,address,ubigeo)
     values($1,$2,$3,$4,'0001','Establecimiento principal','Av. Javier Prado Este 1234','150131')
     on conflict(id) do update set name=excluded.name`,
    [ids.establishment, tenantId, companyId, branchId]
  );
  await client.query(
    `insert into currencies(code,name,symbol) values
      ('PEN','Sol peruano','S/'),('USD','Dólar estadounidense','$')
     on conflict(code) do update set name=excluded.name,symbol=excluded.symbol`
  );
  await client.query(
    `insert into payment_terms(id,tenant_id,company_id,code,name,days,installment_count,created_by)
     values($1,$3,$4,'CONTADO','Contado',0,1,$5),($2,$3,$4,'CREDITO-30','Crédito a 30 días',30,1,$5)
     on conflict(id) do update set name=excluded.name`,
    [ids.cashTerm, ids.creditTerm, tenantId, companyId, userId]
  );
  await client.query(
    `insert into units_of_measure(id,tenant_id,company_id,code,name,sunat_code,allows_decimals,created_by)
     values($1,$3,$4,'UND','Unidad','NIU',true,$5),($2,$3,$4,'ZZ','Servicio','ZZ',true,$5)
     on conflict(id) do update set name=excluded.name`,
    [ids.unit, ids.serviceUnit, tenantId, companyId, userId]
  );
  await client.query(
    `insert into tax_profiles(id,tenant_id,company_id,code,name,tax_category,created_by)
     values($1,$3,$4,'IGV','Gravado con IGV','TAXABLE',$5),
           ($2,$3,$4,'EXONERADO','Operación exonerada','EXEMPT',$5)
     on conflict(id) do update set name=excluded.name`,
    [ids.taxable, ids.exempt, tenantId, companyId, userId]
  );
  await client.query(
    `insert into tax_rates(tenant_id,company_id,tax_profile_id,rate,effective_from,created_by)
     values($1,$2,$3,0.18,'2020-01-01',$4),($1,$2,$5,0,'2020-01-01',$4)
     on conflict(tax_profile_id,effective_from) do update set rate=excluded.rate`,
    [tenantId, companyId, ids.taxable, userId, ids.exempt]
  );
  await client.query(
    `insert into item_categories(id,tenant_id,company_id,code,name,created_by)
     values($1,$3,$4,'OFICINA','Artículos de oficina',$5),($2,$3,$4,'SERVICIOS','Servicios',$5)
     on conflict(id) do update set name=excluded.name`,
    [ids.productCategory, ids.serviceCategory, tenantId, companyId, userId]
  );

  await client.query(
    `insert into parties(id,tenant_id,company_id,party_type,document_type,document_number,normalized_document,
       legal_name,commercial_name,normalized_name,email,phone,notes,created_by)
     values
       ($1,$4,$5,'LEGAL_ENTITY','RUC','20481234567','20481234567','Comercial Rivera S.A.C.',
        'Comercial Rivera','comercial rivera s.a.c. comercial rivera','compras@rivera.demo','999111222',
        'DATOS DE DEMOSTRACIÓN',$6),
       ($2,$4,$5,'LEGAL_ENTITY','RUC','20598765432','20598765432','Distribuidora Pacífico S.A.C.',
        'Distribuidora Pacífico','distribuidora pacífico s.a.c. distribuidora pacífico','ventas@pacifico.demo',
        '999333444','DATOS DE DEMOSTRACIÓN',$6),
       ($3,$4,$5,'NATURAL_PERSON','DNI','45678901','45678901',null,null,
        'ana torres','ana.torres@cliente.demo','999555666','DATOS DE DEMOSTRACIÓN',$6)
     on conflict(id) do update set notes='DATOS DE DEMOSTRACIÓN'`,
    [ids.customer, ids.supplier, ids.customer2, tenantId, companyId, userId]
  );
  await client.query(
    `insert into party_roles(tenant_id,company_id,party_id,role_code,created_by)
     values($1,$2,$3,'CUSTOMER',$6),($1,$2,$4,'SUPPLIER',$6),($1,$2,$5,'CUSTOMER',$6)
     on conflict(company_id,party_id,role_code) do update set status='active',deactivated_at=null`,
    [tenantId, companyId, ids.customer, ids.supplier, ids.customer2, userId]
  );
  await client.query(
    `insert into customer_profiles(party_id,tenant_id,company_id,payment_term_id,credit_limit,allow_credit,updated_by)
     values($1,$3,$4,$5,25000,true,$6),($2,$3,$4,$5,5000,true,$6)
     on conflict(party_id) do update set credit_limit=excluded.credit_limit,allow_credit=true`,
    [ids.customer, ids.customer2, tenantId, companyId, ids.creditTerm, userId]
  );
  await client.query(
    `insert into supplier_profiles(party_id,tenant_id,company_id,payment_term_id,updated_by)
     values($1,$2,$3,$4,$5) on conflict(party_id) do update set payment_term_id=excluded.payment_term_id`,
    [ids.supplier, tenantId, companyId, ids.creditTerm, userId]
  );

  await client.query(
    `insert into items(id,tenant_id,company_id,code,name,description,item_type,category_id,unit_id,
       tax_profile_id,purchase_price,sale_price,currency,manages_stock,minimum_stock,status,created_by)
     values
       ($1,$4,$5,'PAP-A4-80','Papel A4 Copia 80 g','Producto de demostración','PRODUCT',$6,$7,$8,9.50,12.00,'PEN',true,50,'active',$9),
       ($2,$4,$5,'SERV-INST','Servicio de instalación','Servicio de demostración','SERVICE',$10,$11,$8,0,80.00,'PEN',false,0,'active',$9),
       ($3,$4,$5,'TINTA-NEGRA','Tinta negra 500 ml','Consumible de demostración','CONSUMABLE',$6,$7,$8,18.00,25.00,'PEN',true,10,'active',$9)
     on conflict(id) do update set name=excluded.name,sale_price=excluded.sale_price`,
    [
      ids.product, ids.service, ids.consumable, tenantId, companyId, ids.productCategory,
      ids.unit, ids.taxable, userId, ids.serviceCategory, ids.serviceUnit
    ]
  );
  await client.query(
    `insert into price_lists(id,tenant_id,company_id,code,name,currency,valid_from,is_default,created_by)
     values($1,$2,$3,'GENERAL','Lista general PEN','PEN','2026-01-01',true,$4)
     on conflict(id) do update set name=excluded.name,is_default=true`,
    [ids.priceList, tenantId, companyId, userId]
  );
  await client.query(
    `insert into price_list_items(tenant_id,company_id,price_list_id,item_id,minimum_quantity,unit_price,
       maximum_discount_rate,valid_from,created_by)
     values($1,$2,$3,$4,1,12,0.10,'2026-01-01',$7),($1,$2,$3,$5,1,80,0.05,'2026-01-01',$7),
       ($1,$2,$3,$6,1,25,0.05,'2026-01-01',$7)
     on conflict(price_list_id,item_id,minimum_quantity,valid_from) do update set unit_price=excluded.unit_price`,
    [tenantId, companyId, ids.priceList, ids.product, ids.service, ids.consumable, userId]
  );
  await client.query(
    `update customer_profiles set price_list_id=$2 where party_id=$1`,
    [ids.customer, ids.priceList]
  );
  await client.query(
    `insert into customer_price_lists(tenant_id,company_id,customer_party_id,price_list_id,valid_from,created_by)
     values($1,$2,$3,$4,'2026-01-01',$5)
     on conflict(company_id,customer_party_id,price_list_id,valid_from) do nothing`,
    [tenantId, companyId, ids.customer, ids.priceList, userId]
  );

  await client.query(
    `insert into warehouses(id,tenant_id,company_id,branch_id,code,name,address,created_by)
     values($1,$2,$3,$4,'PRINCIPAL','Almacén principal','Av. Argentina 2450, Callao',$5)
     on conflict(id) do update set name=excluded.name`,
    [ids.warehouse, tenantId, companyId, ids.branch2, userId]
  );
  await client.query(
    `insert into stock_movements(id,tenant_id,company_id,branch_id,warehouse_id,movement_type,source_entity_type,
       source_entity_id,reason,idempotency_key,created_by)
     values($1,$2,$3,$4,$5,'OPENING','seed',$1,'DATOS DE DEMOSTRACIÓN','seed-opening-stock',$6)
     on conflict(id) do nothing`,
    [ids.stockOpening, tenantId, companyId, ids.branch2, ids.warehouse, userId]
  );
  await client.query(
    `insert into stock_movement_lines(tenant_id,company_id,stock_movement_id,item_id,quantity,signed_quantity,unit_cost)
     values($1,$2,$3,$4,1200,1200,9.50),($1,$2,$3,$5,80,80,18)
     on conflict do nothing`,
    [tenantId, companyId, ids.stockOpening, ids.product, ids.consumable]
  );
  await client.query(
    `insert into stock_balances(tenant_id,company_id,warehouse_id,item_id,quantity)
     values($1,$2,$3,$4,1200),($1,$2,$3,$5,80)
     on conflict(warehouse_id,item_id) do update set quantity=excluded.quantity,updated_at=now(),version=stock_balances.version+1`,
    [tenantId, companyId, ids.warehouse, ids.product, ids.consumable]
  );
  await client.query(
    `insert into cash_accounts(id,tenant_id,company_id,branch_id,code,name,currency,account_type,created_by)
     values($1,$3,$4,$5,'CAJA-PEN','Caja principal','PEN','CASH',$6),
           ($2,$3,$4,$5,'BANCO-PEN','Cuenta bancaria demostración','PEN','BANK',$6)
     on conflict(id) do update set name=excluded.name`,
    [ids.cashAccount, ids.bankAccount, tenantId, companyId, branchId, userId]
  );
  await client.query(
    `insert into expense_categories(id,tenant_id,company_id,code,name,created_by)
     values($1,$2,$3,'SERVICIOS','Servicios generales',$4)
     on conflict(id) do update set name=excluded.name`,
    [ids.expenseCategory, tenantId, companyId, userId]
  );
  await client.query(
    `insert into document_series(tenant_id,company_id,establishment_id,document_type,series,current_number,created_by)
     values($1,$2,$3,'INVOICE','F001',0,$4),($1,$2,$3,'SALES_RECEIPT','B001',0,$4),
       ($1,$2,$3,'INTERNAL_SALE','VI01',0,$4),($1,$2,$3,'QUOTATION','C001',1,$4),
       ($1,$2,$3,'SALES_ORDER','P001',0,$4),($1,$2,$3,'PURCHASE','CP01',1,$4)
     on conflict(company_id,establishment_id,document_type,series) do nothing`,
    [tenantId, companyId, ids.establishment, userId]
  );

  const customerSnapshot = JSON.stringify({ id: ids.customer, name: "Comercial Rivera S.A.C.", documentType: "RUC", documentNumber: "20481234567" });
  const supplierSnapshot = JSON.stringify({ id: ids.supplier, name: "Distribuidora Pacífico S.A.C.", documentType: "RUC", documentNumber: "20598765432" });
  await client.query(
    `insert into quotations(id,tenant_id,company_id,branch_id,customer_party_id,quotation_number,issue_date,
       valid_until,currency,payment_term_id,customer_snapshot,subtotal,taxable_amount,igv_amount,total,notes,status,created_by)
     values($1,$2,$3,$4,$5,'C001-00000001',current_date,current_date+interval '15 days','PEN',$6,$7::jsonb,
       120,120,21.60,141.60,'DATOS DE DEMOSTRACIÓN','SENT',$8)
     on conflict(id) do update set notes='DATOS DE DEMOSTRACIÓN'`,
    [ids.quotation, tenantId, companyId, branchId, ids.customer, ids.creditTerm, customerSnapshot, userId]
  );
  await client.query(
    `insert into quotation_lines(tenant_id,company_id,quotation_id,line_number,item_id,item_code_snapshot,
       description_snapshot,unit_snapshot,quantity,unit_price,discount_rate,tax_category,tax_rate,
       subtotal,discount_amount,tax_amount,total)
     values($1,$2,$3,1,$4,'PAP-A4-80','Papel A4 Copia 80 g','UND',10,12,0,'TAXABLE',0.18,120,0,21.60,141.60)
     on conflict(quotation_id,line_number) do nothing`,
    [tenantId, companyId, ids.quotation, ids.product]
  );
  await client.query(
    `insert into sales(id,tenant_id,company_id,branch_id,warehouse_id,customer_party_id,sale_number,sale_date,
       currency,payment_condition,due_date,customer_snapshot,subtotal,taxable_amount,igv_amount,total,status,confirmed_at,created_by)
     values($1,$2,$3,$4,$5,$6,'VI01-00000001',now()-interval '2 days','PEN','CREDIT',current_date+28,
       $7::jsonb,80,80,14.40,94.40,'CONFIRMED',now()-interval '2 days',$8)
     on conflict(id) do update set customer_snapshot=excluded.customer_snapshot`,
    [ids.sale, tenantId, companyId, branchId, ids.warehouse, ids.customer, customerSnapshot, userId]
  );
  await client.query(
    `insert into sale_lines(tenant_id,company_id,sale_id,line_number,item_id,item_code_snapshot,description_snapshot,
       unit_snapshot,quantity,unit_price,discount_rate,tax_category,tax_rate,subtotal,discount_amount,tax_amount,total,stock_managed)
     values($1,$2,$3,1,$4,'SERV-INST','Servicio de instalación','ZZ',1,80,0,'TAXABLE',0.18,80,0,14.40,94.40,false)
     on conflict(sale_id,line_number) do nothing`,
    [tenantId, companyId, ids.sale, ids.service]
  );
  await client.query(
    `insert into accounts_receivable(id,tenant_id,company_id,customer_party_id,sale_id,currency,principal,
       applied_amount,outstanding_amount,due_date,status,notes,created_by)
     values($1,$2,$3,$4,$5,'PEN',94.40,0,94.40,current_date+28,'OPEN','DATOS DE DEMOSTRACIÓN',$6)
     on conflict(id) do update set notes='DATOS DE DEMOSTRACIÓN'`,
    [ids.receivable, tenantId, companyId, ids.customer, ids.sale, userId]
  );
  await client.query(
    `insert into purchases(id,tenant_id,company_id,branch_id,warehouse_id,supplier_party_id,purchase_number,
       purchase_date,issue_date,due_date,currency,payment_condition,supplier_snapshot,subtotal,taxable_amount,
       igv_amount,total,status,confirmed_at,created_by)
     values($1,$2,$3,$4,$5,$6,'CP01-00000001',current_date-3,current_date-3,current_date+27,'PEN','CREDIT',
       $7::jsonb,180,180,32.40,212.40,'CONFIRMED',now()-interval '3 days',$8)
     on conflict(id) do update set supplier_snapshot=excluded.supplier_snapshot`,
    [ids.purchase, tenantId, companyId, branchId, ids.warehouse, ids.supplier, supplierSnapshot, userId]
  );
  await client.query(
    `insert into purchase_lines(tenant_id,company_id,purchase_id,line_number,item_id,item_code_snapshot,
       description_snapshot,unit_snapshot,quantity,unit_cost,tax_category,tax_rate,tax_amount,total,stock_managed)
     values($1,$2,$3,1,$4,'TINTA-NEGRA','Tinta negra 500 ml','UND',10,18,'TAXABLE',0.18,32.40,212.40,true)
     on conflict(purchase_id,line_number) do nothing`,
    [tenantId, companyId, ids.purchase, ids.consumable]
  );
  await client.query(
    `insert into accounts_payable(id,tenant_id,company_id,supplier_party_id,purchase_id,currency,principal,
       applied_amount,outstanding_amount,due_date,status,notes,created_by)
     values($1,$2,$3,$4,$5,'PEN',212.40,0,212.40,current_date+27,'OPEN','DATOS DE DEMOSTRACIÓN',$6)
     on conflict(id) do update set notes='DATOS DE DEMOSTRACIÓN'`,
    [ids.payable, tenantId, companyId, ids.supplier, ids.purchase, userId]
  );
}
