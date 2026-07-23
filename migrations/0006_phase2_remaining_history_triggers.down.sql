drop trigger if exists commercial_document_events_no_delete on commercial_document_events;
drop trigger if exists commercial_document_events_no_update on commercial_document_events;
drop trigger if exists cash_movements_no_delete on cash_movements;
drop trigger if exists cash_movements_no_update on cash_movements;

create rule cash_movements_no_update as on update to cash_movements do instead nothing;
create rule cash_movements_no_delete as on delete to cash_movements do instead nothing;
create rule commercial_document_events_no_update as on update to commercial_document_events do instead nothing;
create rule commercial_document_events_no_delete as on delete to commercial_document_events do instead nothing;
