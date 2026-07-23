drop trigger if exists payments_no_delete on payments;
drop trigger if exists payment_applications_no_delete on payment_applications;
drop trigger if exists payment_applications_no_update on payment_applications;
drop trigger if exists stock_movement_lines_no_delete on stock_movement_lines;
drop trigger if exists stock_movement_lines_no_update on stock_movement_lines;
drop trigger if exists stock_movements_no_delete on stock_movements;
drop trigger if exists stock_movements_no_update on stock_movements;
drop function if exists reject_history_mutation();

create rule stock_movements_no_update as on update to stock_movements do instead nothing;
create rule stock_movements_no_delete as on delete to stock_movements do instead nothing;
create rule stock_movement_lines_no_update as on update to stock_movement_lines do instead nothing;
create rule stock_movement_lines_no_delete as on delete to stock_movement_lines do instead nothing;
create rule payment_applications_no_update as on update to payment_applications do instead nothing;
create rule payment_applications_no_delete as on delete to payment_applications do instead nothing;
create rule payments_no_delete as on delete to payments do instead nothing;
