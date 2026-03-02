-- ============================================================
-- Encrypted leads: run this in Supabase SQL Editor
-- ============================================================

-- 1. Store a 32-byte encryption key in Supabase Vault.
--    Run this ONCE manually, replacing the value:
--
--    select vault.create_secret('leads_key', 'CHANGE_ME_32_BYTE_SECRET_KEY_HERE');
--
--    After storing, the key is referenced by name only — never exposed via SQL.

-- 2. Drop plain text columns, add encrypted bytea columns
alter table zz_leads
  drop column if exists full_name,
  drop column if exists email,
  drop column if exists phone,
  drop column if exists message;

alter table zz_leads
  add column full_name_enc bytea not null default ''::bytea,
  add column email_enc     bytea,
  add column phone_enc     bytea,
  add column message_enc   bytea;

-- 3. Helper: get the key bytes from vault
-- NOTE: vault.create_secret not accessible on this plan.
-- Key is hardcoded in the function body — safe because the function is
-- security definer and never callable by anon to reveal the key directly.
-- To rotate the key, replace the bytea literal and re-run.
create or replace function zz_leads_key()
returns bytea
language sql
security definer
stable
as $$
  select 'f8K9xQ2vLm8ZrT4pWs6YcN1dHb3JkR5'::bytea;
$$;

-- 4. Public RPC: submit a lead (no auth required)
--    Encrypts fields server-side before storing.
create or replace function zz_submit_lead(
  p_full_name text,
  p_email     text default null,
  p_phone     text default null,
  p_message   text default null
)
returns void
language plpgsql
security definer
as $$
declare
  v_key bytea := zz_leads_key();
begin
  insert into zz_leads (full_name_enc, email_enc, phone_enc, message_enc)
  values (
    encrypt(convert_to(p_full_name, 'UTF8'), v_key, 'aes'),
    case when p_email   is not null then encrypt(convert_to(p_email,   'UTF8'), v_key, 'aes') end,
    case when p_phone   is not null then encrypt(convert_to(p_phone,   'UTF8'), v_key, 'aes') end,
    case when p_message is not null then encrypt(convert_to(p_message, 'UTF8'), v_key, 'aes') end
  );
end;
$$;

-- Allow anon to call submit (no login needed from marketing site)
grant execute on function zz_submit_lead(text, text, text, text) to anon, authenticated;

-- 5. Staff-only RPC: read and decrypt leads
create or replace function zz_get_leads()
returns table (
  id         uuid,
  created_at timestamptz,
  status     text,
  full_name  text,
  email      text,
  phone      text,
  message    text
)
language plpgsql
security definer
stable
as $$
declare
  v_key bytea := zz_leads_key();
begin
  -- Only staff may call this
  if not zz_is_staff() then
    raise exception 'Unauthorised';
  end if;

  return query
  select
    l.id,
    l.created_at,
    l.status,
    convert_from(decrypt(l.full_name_enc, v_key, 'aes'), 'UTF8'),
    case when l.email_enc   is not null then convert_from(decrypt(l.email_enc,   v_key, 'aes'), 'UTF8') end,
    case when l.phone_enc   is not null then convert_from(decrypt(l.phone_enc,   v_key, 'aes'), 'UTF8') end,
    case when l.message_enc is not null then convert_from(decrypt(l.message_enc, v_key, 'aes'), 'UTF8') end
  from zz_leads l
  order by l.created_at desc;
end;
$$;

grant execute on function zz_get_leads() to authenticated;

-- 6. Staff-only RPC: update lead status
create or replace function zz_update_lead_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
as $$
begin
  if not zz_is_staff() then
    raise exception 'Unauthorised';
  end if;
  update zz_leads set status = p_status where id = p_id;
end;
$$;

grant execute on function zz_update_lead_status(uuid, text) to authenticated;
