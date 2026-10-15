# Verify

`verify_schema.sql` is the executable read-only contract for the complete PostgreSQL baseline. It is run
after schema, seed, functions, and grants, and must return no `FAIL` rows.

Hard rules for `verify_schema.sql`:

- read-only;
- no DDL;
- no DML;
- no grants or revokes;
- no temporary tables;
- no mutation runtime_api calls;
- no repair logic;
- no business logic changes;
- no new rules beyond the accepted SQL Implementation Plan;
- acceptance requires zero `FAIL` rows;
- a result that requires static review must not be represented as executable proof.
