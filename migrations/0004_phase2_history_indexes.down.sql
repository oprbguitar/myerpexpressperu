-- SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
-- SPDX-License-Identifier: MPL-2.0
drop index if exists payments_reversed_payment;
drop index if exists stock_movements_linked;
drop index if exists payment_applications_reversal;
drop index if exists purchase_lines_item;
drop index if exists sale_lines_item;
drop index if exists sales_order_lines_item;
drop index if exists quotation_lines_item;

drop rule if exists payments_no_delete on payments;
drop rule if exists payment_applications_no_delete on payment_applications;
drop rule if exists payment_applications_no_update on payment_applications;
drop rule if exists stock_movement_lines_no_delete on stock_movement_lines;
drop rule if exists stock_movement_lines_no_update on stock_movement_lines;
drop rule if exists stock_movements_no_delete on stock_movements;
drop rule if exists stock_movements_no_update on stock_movements;
