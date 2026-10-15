\set ON_ERROR_STOP on

\if :admin_telegram_qr_apply

create table app.admin_telegram_qr_challenges (
    admin_telegram_qr_challenge_id bigint generated always as identity primary key,
    confirmation_token_hash text not null,
    browser_token_hash text not null,
    created_ip inet null,
    user_agent text null,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null,
    confirmed_employee_id bigint null,
    confirmed_at timestamptz null,
    claimed_admin_session_id bigint null,
    claimed_at timestamptz null,
    constraint admin_telegram_qr_challenges_confirmation_token_hash_uniq
        unique (confirmation_token_hash),
    constraint admin_telegram_qr_challenges_browser_token_hash_uniq
        unique (browser_token_hash),
    constraint admin_telegram_qr_challenges_claimed_session_uniq
        unique (claimed_admin_session_id),
    constraint admin_telegram_qr_challenges_confirmed_employee_id_fk
        foreign key (confirmed_employee_id) references app.employees (employee_id),
    constraint admin_telegram_qr_challenges_claimed_session_id_fk
        foreign key (claimed_admin_session_id) references app.admin_sessions (admin_session_id),
    constraint admin_telegram_qr_challenges_confirmation_token_hash_format_chk check (
        confirmation_token_hash ~ '^[a-f0-9]{64}$'
    ),
    constraint admin_telegram_qr_challenges_browser_token_hash_format_chk check (
        browser_token_hash ~ '^[a-f0-9]{64}$'
    ),
    constraint admin_telegram_qr_challenges_user_agent_length_chk check (
        user_agent is null or char_length(user_agent) between 1 and 512
    ),
    constraint admin_telegram_qr_challenges_expiry_chk check (
        expires_at > created_at
    ),
    constraint admin_telegram_qr_challenges_lifecycle_chk check (
        (
            confirmed_employee_id is null
            and confirmed_at is null
            and claimed_admin_session_id is null
            and claimed_at is null
        )
        or (
            confirmed_employee_id is not null
            and confirmed_at is not null
            and confirmed_at >= created_at
            and confirmed_at <= expires_at
            and claimed_admin_session_id is null
            and claimed_at is null
        )
        or (
            confirmed_employee_id is not null
            and confirmed_at is not null
            and confirmed_at >= created_at
            and confirmed_at <= expires_at
            and claimed_admin_session_id is not null
            and claimed_at is not null
            and claimed_at >= confirmed_at
            and claimed_at <= expires_at
        )
    )
);

create index admin_telegram_qr_challenges_pending_expiry_idx
    on app.admin_telegram_qr_challenges (expires_at)
    where claimed_at is null;

create index admin_telegram_qr_challenges_created_ip_idx
    on app.admin_telegram_qr_challenges (created_ip, created_at)
    where created_ip is not null;

create index admin_telegram_qr_challenges_confirmed_employee_idx
    on app.admin_telegram_qr_challenges (confirmed_employee_id, confirmed_at)
    where confirmed_employee_id is not null;

\ir ../../functions/functions.sql

revoke all privileges on table app.admin_telegram_qr_challenges
    from app_runtime_role, readonly_role, public;

revoke execute on function app.create_admin_telegram_qr_challenge(text, text, text, text)
    from public, readonly_role;
revoke execute on function app.confirm_admin_telegram_qr_challenge(text, bigint)
    from public, readonly_role;
revoke execute on function app.claim_admin_telegram_qr_challenge(bigint, text, text, text, text, text)
    from public, readonly_role;

grant execute on function app.create_admin_telegram_qr_challenge(text, text, text, text)
    to app_runtime_role;
grant execute on function app.confirm_admin_telegram_qr_challenge(text, bigint)
    to app_runtime_role;
grant execute on function app.claim_admin_telegram_qr_challenge(bigint, text, text, text, text, text)
    to app_runtime_role;

\endif
