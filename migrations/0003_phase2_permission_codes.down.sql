delete from permissions
where code !~ '^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$';
alter table permissions drop constraint permissions_code_check;
alter table permissions add constraint permissions_code_check
  check(code ~ '^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$');

