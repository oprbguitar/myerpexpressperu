-- SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
-- SPDX-License-Identifier: MPL-2.0
-- Replace rewrite rules with triggers so INSERT ... ON CONFLICT remains legal.

create or replace function reject_history_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'HISTORY_IS_APPEND_ONLY' using errcode = '55000';
end;
$$;

drop rule if exists stock_movements_no_update on stock_movements;
drop rule if exists stock_movements_no_delete on stock_movements;
drop rule if exists stock_movement_lines_no_update on stock_movement_lines;
drop rule if exists stock_movement_lines_no_delete on stock_movement_lines;
drop rule if exists payment_applications_no_update on payment_applications;
drop rule if exists payment_applications_no_delete on payment_applications;
drop rule if exists payments_no_delete on payments;

create trigger stock_movements_no_update
before update on stock_movements for each row execute function reject_history_mutation();
create trigger stock_movements_no_delete
before delete on stock_movements for each row execute function reject_history_mutation();
create trigger stock_movement_lines_no_update
before update on stock_movement_lines for each row execute function reject_history_mutation();
create trigger stock_movement_lines_no_delete
before delete on stock_movement_lines for each row execute function reject_history_mutation();
create trigger payment_applications_no_update
before update on payment_applications for each row execute function reject_history_mutation();
create trigger payment_applications_no_delete
before delete on payment_applications for each row execute function reject_history_mutation();
create trigger payments_no_delete
before delete on payments for each row execute function reject_history_mutation();
