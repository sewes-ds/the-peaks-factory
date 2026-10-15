\set ON_ERROR_STOP on

\if :admin_auth_apply

alter table app.roles
    add column can_access_admin_panel boolean not null default false;

create table app.admin_password_credentials (
    admin_password_credential_id bigint generated always as identity primary key,
    employee_id bigint not null,
    login_name text not null,
    password_hash text not null,
    must_change_password boolean not null default true,
    failed_attempt_count smallint not null default 0,
    locked_until timestamptz null,
    is_active boolean not null default true,
    password_changed_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint admin_password_credentials_employee_id_fk foreign key (employee_id)
        references app.employees (employee_id),
    constraint admin_password_credentials_employee_id_uniq unique (employee_id),
    constraint admin_password_credentials_login_name_uniq unique (login_name),
    constraint admin_password_credentials_login_name_format_chk check (
        login_name ~ '^[a-z0-9][a-z0-9._-]{2,63}$'
    ),
    constraint admin_password_credentials_password_hash_format_chk check (
        password_hash ~ '^scrypt\$v1\$[0-9]+\$[0-9]+\$[0-9]+\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$'
    ),
    constraint admin_password_credentials_failed_attempt_count_chk check (
        failed_attempt_count between 0 and 5
    )
);

create index admin_password_credentials_locked_until_idx
    on app.admin_password_credentials (locked_until)
    where is_active = true and locked_until is not null;

create table app.admin_sessions (
    admin_session_id bigint generated always as identity primary key,
    employee_id bigint not null,
    admin_password_credential_id bigint null,
    auth_method text not null,
    session_token_hash text not null,
    csrf_token_hash text not null,
    created_ip inet null,
    user_agent text null,
    created_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    idle_expires_at timestamptz not null,
    expires_at timestamptz not null,
    revoked_at timestamptz null,
    revoked_reason text null,
    constraint admin_sessions_employee_id_fk foreign key (employee_id)
        references app.employees (employee_id),
    constraint admin_sessions_password_credential_id_fk foreign key (admin_password_credential_id)
        references app.admin_password_credentials (admin_password_credential_id),
    constraint admin_sessions_session_token_hash_uniq unique (session_token_hash),
    constraint admin_sessions_auth_method_chk check (
        auth_method in ('PASSWORD', 'TELEGRAM_QR')
    ),
    constraint admin_sessions_provider_reference_chk check (
        (auth_method = 'PASSWORD' and admin_password_credential_id is not null)
        or (auth_method = 'TELEGRAM_QR' and admin_password_credential_id is null)
    ),
    constraint admin_sessions_session_token_hash_format_chk check (
        session_token_hash ~ '^[a-f0-9]{64}$'
    ),
    constraint admin_sessions_csrf_token_hash_format_chk check (
        csrf_token_hash ~ '^[a-f0-9]{64}$'
    ),
    constraint admin_sessions_user_agent_length_chk check (
        user_agent is null or char_length(user_agent) between 1 and 512
    ),
    constraint admin_sessions_lifetime_chk check (
        last_seen_at >= created_at
        and idle_expires_at > last_seen_at
        and expires_at > created_at
        and idle_expires_at <= expires_at
    ),
    constraint admin_sessions_revocation_state_chk check (
        (revoked_at is null and revoked_reason is null)
        or (
            revoked_at is not null
            and revoked_reason is not null
            and btrim(revoked_reason) <> ''
            and revoked_at >= created_at
        )
    )
);

create index admin_sessions_employee_active_idx
    on app.admin_sessions (employee_id, expires_at)
    where revoked_at is null;

create index admin_sessions_expiry_idx
    on app.admin_sessions (least(idle_expires_at, expires_at))
    where revoked_at is null;

update app.roles
set
    can_access_admin_panel = role_name in (
        'Руководитель производства',
        'Руководитель администрации',
        'Директор',
        'Администратор системы'
    ),
    updated_at = now();

\ir ../../functions/functions.sql

revoke all privileges on table app.admin_password_credentials
    from app_runtime_role, readonly_role, public;
revoke all privileges on table app.admin_sessions
    from app_runtime_role, readonly_role, public;

revoke execute on function app.read_admin_password_credential(text)
    from public, readonly_role;
revoke execute on function app.record_admin_password_failure(bigint)
    from public, readonly_role;
revoke execute on function app.start_admin_password_session(bigint, text, text, text, text)
    from public, readonly_role;
revoke execute on function app.resolve_admin_session(text)
    from public, readonly_role;
revoke execute on function app.read_admin_password_credential_for_session(text)
    from public, readonly_role;
revoke execute on function app.change_admin_password(text, text)
    from public, readonly_role;
revoke execute on function app.revoke_admin_session(text, text)
    from public, readonly_role;
revoke execute on function app.read_admin_overview(text)
    from public, readonly_role;
revoke execute on function app.read_admin_directory(text)
    from public, readonly_role;
revoke execute on function app.prepare_admin_qr_label(text, text, bigint)
    from public, readonly_role;
revoke execute on function app._require_admin_session_actor(text)
    from public, app_runtime_role, readonly_role;
revoke execute on function app.save_admin_employee(text, bigint, text, text, bigint, bigint, text)
    from public, readonly_role;
revoke execute on function app.save_admin_position(text, bigint, text, text, boolean, boolean, text)
    from public, readonly_role;
revoke execute on function app.save_admin_machine(text, bigint, text, text, bigint, text, text)
    from public, readonly_role;
revoke execute on function app.save_admin_sku(text, bigint, text, text, bigint, numeric, numeric, boolean, text, text)
    from public, readonly_role;
revoke execute on function app.save_admin_additional_work_type(text, bigint, text, boolean, text)
    from public, readonly_role;
revoke execute on function app.create_admin_activity_type(text, text, text, text, integer, bigint, text)
    from public, readonly_role;
revoke execute on function app.deactivate_admin_activity_type(text, text, bigint, text)
    from public, readonly_role;

grant execute on function app.read_admin_password_credential(text) to app_runtime_role;
grant execute on function app.record_admin_password_failure(bigint) to app_runtime_role;
grant execute on function app.start_admin_password_session(bigint, text, text, text, text)
    to app_runtime_role;
grant execute on function app.resolve_admin_session(text) to app_runtime_role;
grant execute on function app.read_admin_password_credential_for_session(text)
    to app_runtime_role;
grant execute on function app.change_admin_password(text, text) to app_runtime_role;
grant execute on function app.revoke_admin_session(text, text) to app_runtime_role;
grant execute on function app.read_admin_overview(text) to app_runtime_role;
grant execute on function app.read_admin_directory(text) to app_runtime_role;
grant execute on function app.prepare_admin_qr_label(text, text, bigint) to app_runtime_role;
grant execute on function app.save_admin_employee(text, bigint, text, text, bigint, bigint, text)
    to app_runtime_role;
grant execute on function app.save_admin_position(text, bigint, text, text, boolean, boolean, text)
    to app_runtime_role;
grant execute on function app.save_admin_machine(text, bigint, text, text, bigint, text, text)
    to app_runtime_role;
grant execute on function app.save_admin_sku(text, bigint, text, text, bigint, numeric, numeric, boolean, text, text)
    to app_runtime_role;
grant execute on function app.save_admin_additional_work_type(text, bigint, text, boolean, text)
    to app_runtime_role;
grant execute on function app.create_admin_activity_type(text, text, text, text, integer, bigint, text)
    to app_runtime_role;
grant execute on function app.deactivate_admin_activity_type(text, text, bigint, text)
    to app_runtime_role;

\endif
