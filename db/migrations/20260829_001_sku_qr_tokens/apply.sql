\set ON_ERROR_STOP on

do $apply$
begin
    if (select mode from _sku_qr_context) = 'NOOP' then
        return;
    end if;
    if (select mode from _sku_qr_context) <> 'APPLY' then
        raise exception using errcode = '55000', message = 'SKU_QR_APPLY_MODE_MISSING';
    end if;

    alter table app.skus add column sku_qr_token text null;

    update app.skus s
    set sku_qr_token = i.generated_protected_qr_token
    from _sku_qr_stage i
    where i.sku_id = s.sku_id;

    alter table app.skus alter column sku_qr_token set not null;
    alter table app.skus add constraint skus_sku_qr_token_uniq unique (sku_qr_token);
    alter table app.skus add constraint skus_sku_qr_token_format_chk
        check (sku_qr_token ~ '^[A-Za-z0-9_-]{32}$');

    execute $function_ddl$
        create or replace function app.rotate_sku_qr_token(
            p_actor_employee_id bigint,
            p_sku_id bigint,
            p_new_sku_qr_token text,
            p_reason text
        )
        returns bigint
        language plpgsql
        security definer
        set search_path = app, pg_catalog
        as $$
        declare
            v_reason text;
            v_new_token text;
            v_old_token text;
        begin
            v_reason := app._assert_nonempty_text(p_reason, 'p_reason');
            v_new_token := app._assert_nonempty_text(p_new_sku_qr_token, 'p_new_sku_qr_token');
            if v_new_token !~ '^[A-Za-z0-9_-]{32}$' then
                raise exception 'new SKU QR token must contain exactly 32 base64url characters'
                    using errcode = '22023';
            end if;
            perform app._assert_actor_has_any_permission(
                p_actor_employee_id,
                array['can_manage_production', 'can_system_emergency_actions']
            );
            select s.sku_qr_token into v_old_token
            from app.skus s where s.sku_id = p_sku_id for update;
            if not found then
                raise exception 'SKU not found' using errcode = 'P0001';
            end if;
            if v_old_token = v_new_token then
                raise exception 'new SKU QR token must differ from current token' using errcode = '22023';
            end if;
            update app.skus set sku_qr_token = v_new_token, updated_at = now() where sku_id = p_sku_id;
            perform app._insert_audit_event(
                p_actor_employee_id, 'rotate_sku_qr_token', 'skus', p_sku_id,
                jsonb_build_object('sku_id', p_sku_id, 'sku_qr_token_present', true, 'sku_qr_token_length', length(v_old_token)),
                jsonb_build_object('sku_id', p_sku_id, 'sku_qr_token_rotated', true, 'sku_qr_token_length', length(v_new_token)),
                v_reason
            );
            return p_sku_id;
        end;
        $$
    $function_ddl$;

    comment on function app.rotate_sku_qr_token(bigint, bigint, text, text)
        is 'runtime_api: rotates a SKU QR token with reason and redacted audit evidence.';
    revoke all on function app.rotate_sku_qr_token(bigint, bigint, text, text)
        from public, app_runtime_role, readonly_role;
    grant execute on function app.rotate_sku_qr_token(bigint, bigint, text, text)
        to app_runtime_role;
end;
$apply$;
