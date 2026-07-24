-- SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
-- SPDX-License-Identifier: MPL-2.0
-- Phase 2 hardening: immutable operational history and missing FK lookup indexes.

create rule stock_movements_no_update as on update to stock_movements do instead nothing;
create rule stock_movements_no_delete as on delete to stock_movements do instead nothing;
create rule stock_movement_lines_no_update as on update to stock_movement_lines do instead nothing;
create rule stock_movement_lines_no_delete as on delete to stock_movement_lines do instead nothing;
create rule payment_applications_no_update as on update to payment_applications do instead nothing;
create rule payment_applications_no_delete as on delete to payment_applications do instead nothing;
create rule payments_no_delete as on delete to payments do instead nothing;

create index if not exists quotation_lines_item on quotation_lines(item_id, quotation_id);
create index if not exists sales_order_lines_item on sales_order_lines(item_id, sales_order_id);
create index if not exists sale_lines_item on sale_lines(item_id, sale_id);
create index if not exists purchase_lines_item on purchase_lines(item_id, purchase_id);
create index if not exists payment_applications_reversal
  on payment_applications(reverses_application_id)
  where reverses_application_id is not null;
create index if not exists stock_movements_linked
  on stock_movements(linked_movement_id)
  where linked_movement_id is not null;
create index if not exists payments_reversed_payment
  on payments(reversed_payment_id)
  where reversed_payment_id is not null;
