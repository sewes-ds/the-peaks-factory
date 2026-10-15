# Grants

`grants.sql` defines the database security boundary. Runtime credentials must not be broadened to make a
migration or test convenient; migrations use a separately controlled role and release procedure.
