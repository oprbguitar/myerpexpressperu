-- Complete Phase 2 append-only trigger conversion.

drop rule if exists cash_movements_no_update on cash_movements;
drop rule if exists cash_movements_no_delete on cash_movements;
drop rule if exists commercial_document_events_no_update on commercial_document_events;
drop rule if exists commercial_document_events_no_delete on commercial_document_events;

create trigger cash_movements_no_update
before update on cash_movements for each row execute function reject_history_mutation();
create trigger cash_movements_no_delete
before delete on cash_movements for each row execute function reject_history_mutation();
create trigger commercial_document_events_no_update
before update on commercial_document_events for each row execute function reject_history_mutation();
create trigger commercial_document_events_no_delete
before delete on commercial_document_events for each row execute function reject_history_mutation();
