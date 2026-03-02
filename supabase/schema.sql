create extension if not exists pgcrypto;

create table if not exists zz_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  role text not null check (role in ('owner', 'staff', 'client')),
  full_name text not null default '',
  phone text null
);

alter table zz_profiles enable row level security;

create or replace function zz_is_staff()
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from zz_profiles p
    where p.user_id = auth.uid()
      and p.role in ('owner', 'staff')
  );
$$;

create policy zz_profiles_select_own
on zz_profiles
for select
using (user_id = auth.uid() or zz_is_staff());

create policy zz_profiles_update_own
on zz_profiles
for update
using (user_id = auth.uid() or zz_is_staff())
with check (user_id = auth.uid() or zz_is_staff());

create table if not exists zz_clients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid unique null references auth.users (id) on delete set null,
  full_name text not null,
  email text not null,
  phone text null
);

alter table zz_clients enable row level security;

create policy zz_clients_select
on zz_clients
for select
using (zz_is_staff() or user_id = auth.uid());

create policy zz_clients_insert_staff
on zz_clients
for insert
with check (zz_is_staff());

create policy zz_clients_update_staff
on zz_clients
for update
using (zz_is_staff())
with check (zz_is_staff());

create table if not exists zz_job_phases (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  position int not null,
  is_active boolean not null default true
);

alter table zz_job_phases enable row level security;

create policy zz_job_phases_read
on zz_job_phases
for select
using (zz_is_staff() or true);

create policy zz_job_phases_write_staff
on zz_job_phases
for all
using (zz_is_staff())
with check (zz_is_staff());

-- ── Seed default phase pipeline ─────────────────────────────
insert into zz_job_phases (name, position, is_active)
select name, position, is_active from (values
  ('Enquiry', 1, true),
  ('Survey', 2, true),
  ('Quotes Due', 3, true),
  ('Quotes Received', 4, true),
  ('Quote Accepted', 5, true),
  ('Parts Ordered', 6, true),
  ('Parts Received', 7, true),
  ('Scheduled', 8, true),
  ('In Progress', 9, true),
  ('Final Check', 10, true),
  ('Invoiced', 11, true),
  ('Paid', 12, true),
  ('Completed', 13, true)
) as v(name, position, is_active)
where not exists (select 1 from zz_job_phases where zz_job_phases.name = v.name);

create table if not exists zz_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'history', 'deleted')),
  title text not null,
  client_id uuid not null references zz_clients (id) on delete restrict,
  current_phase_id uuid null references zz_job_phases (id) on delete set null,
  address_line_1 text not null,
  address_line_2 text null,
  town_city text not null,
  county text null,
  postcode text not null,
  archived_at timestamptz null,
  delete_after timestamptz null
);

alter table zz_jobs enable row level security;

create policy zz_jobs_select
on zz_jobs
for select
using (
  zz_is_staff()
  or exists (
    select 1
    from zz_clients c
    where c.id = zz_jobs.client_id
      and c.user_id = auth.uid()
  )
);

create policy zz_jobs_insert_staff
on zz_jobs
for insert
with check (zz_is_staff());

create policy zz_jobs_update_staff
on zz_jobs
for update
using (zz_is_staff())
with check (zz_is_staff());

create table if not exists zz_job_notes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  job_id uuid not null references zz_jobs (id) on delete cascade,
  author_user_id uuid null references auth.users (id) on delete set null,
  is_client_visible boolean not null default false,
  body text not null
);

alter table zz_job_notes enable row level security;

create policy zz_job_notes_select
on zz_job_notes
for select
using (
  zz_is_staff()
  or (
    is_client_visible = true
    and exists (
      select 1
      from zz_jobs j
      join zz_clients c on c.id = j.client_id
      where j.id = zz_job_notes.job_id
        and c.user_id = auth.uid()
    )
  )
);

create policy zz_job_notes_insert_staff
on zz_job_notes
for insert
with check (zz_is_staff());

create policy zz_job_notes_update_staff
on zz_job_notes
for update
using (zz_is_staff())
with check (zz_is_staff());

create table if not exists zz_activity_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  job_id uuid not null references zz_jobs (id) on delete cascade,
  actor_user_id uuid null references auth.users (id) on delete set null,
  actor_role text not null check (actor_role in ('owner', 'staff', 'client', 'system')),
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  is_client_visible boolean not null default true
);

alter table zz_activity_events enable row level security;

create policy zz_activity_events_select
on zz_activity_events
for select
using (
  zz_is_staff()
  or (
    is_client_visible = true
    and exists (
      select 1
      from zz_jobs j
      join zz_clients c on c.id = j.client_id
      where j.id = zz_activity_events.job_id
        and c.user_id = auth.uid()
    )
  )
);

create policy zz_activity_events_insert_staff
on zz_activity_events
for insert
with check (zz_is_staff());

create table if not exists zz_files (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  job_id uuid not null references zz_jobs (id) on delete cascade,
  uploader_user_id uuid null references auth.users (id) on delete set null,
  storage_bucket text not null,
  storage_path text not null,
  filename text not null,
  mime_type text null,
  size_bytes bigint null,
  is_client_visible boolean not null default false,
  file_type text null check (file_type in ('quote', 'invoice', 'photo', 'other'))
);

alter table zz_files enable row level security;

create policy zz_files_select
on zz_files
for select
using (
  zz_is_staff()
  or (
    is_client_visible = true
    and exists (
      select 1
      from zz_jobs j
      join zz_clients c on c.id = j.client_id
      where j.id = zz_files.job_id
        and c.user_id = auth.uid()
    )
  )
);

create policy zz_files_insert_staff
on zz_files
for insert
with check (zz_is_staff());

create table if not exists zz_quotes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  job_id uuid not null references zz_jobs (id) on delete cascade,
  quote_number text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected')),
  issued_at timestamptz null,
  accepted_at timestamptz null,
  rejected_at timestamptz null,
  subtotal_pence int not null default 0,
  vat_pence int not null default 0,
  total_pence int not null default 0,
  pdf_path text null
);

alter table zz_quotes enable row level security;

create policy zz_quotes_select
on zz_quotes
for select
using (
  zz_is_staff()
  or exists (
    select 1
    from zz_jobs j
    join zz_clients c on c.id = j.client_id
    where j.id = zz_quotes.job_id
      and c.user_id = auth.uid()
  )
);

create policy zz_quotes_write_staff
on zz_quotes
for all
using (zz_is_staff())
with check (zz_is_staff());

create table if not exists zz_quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references zz_quotes (id) on delete cascade,
  position int not null,
  description text not null,
  qty numeric(12,2) not null default 1,
  unit_price_pence int not null default 0,
  line_total_pence int not null default 0
);

alter table zz_quote_items enable row level security;

create policy zz_quote_items_select
on zz_quote_items
for select
using (
  exists (
    select 1
    from zz_quotes q
    where q.id = zz_quote_items.quote_id
      and (
        zz_is_staff()
        or exists (
          select 1
          from zz_jobs j
          join zz_clients c on c.id = j.client_id
          where j.id = q.job_id
            and c.user_id = auth.uid()
        )
      )
  )
);

create policy zz_quote_items_write_staff
on zz_quote_items
for all
using (zz_is_staff())
with check (zz_is_staff());

create table if not exists zz_invoices (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  job_id uuid not null references zz_jobs (id) on delete cascade,
  invoice_number text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid')),
  issued_at timestamptz null,
  paid_at timestamptz null,
  subtotal_pence int not null default 0,
  vat_pence int not null default 0,
  total_pence int not null default 0,
  pdf_path text null
);

alter table zz_invoices enable row level security;

create policy zz_invoices_select
on zz_invoices
for select
using (
  zz_is_staff()
  or exists (
    select 1
    from zz_jobs j
    join zz_clients c on c.id = j.client_id
    where j.id = zz_invoices.job_id
      and c.user_id = auth.uid()
  )
);

create policy zz_invoices_write_staff
on zz_invoices
for all
using (zz_is_staff())
with check (zz_is_staff());

create table if not exists zz_invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references zz_invoices (id) on delete cascade,
  position int not null,
  description text not null,
  qty numeric(12,2) not null default 1,
  unit_price_pence int not null default 0,
  line_total_pence int not null default 0
);

alter table zz_invoice_items enable row level security;

create policy zz_invoice_items_select
on zz_invoice_items
for select
using (
  exists (
    select 1
    from zz_invoices i
    where i.id = zz_invoice_items.invoice_id
      and (
        zz_is_staff()
        or exists (
          select 1
          from zz_jobs j
          join zz_clients c on c.id = j.client_id
          where j.id = i.job_id
            and c.user_id = auth.uid()
        )
      )
  )
);

create policy zz_invoice_items_write_staff
on zz_invoice_items
for all
using (zz_is_staff())
with check (zz_is_staff());

create table if not exists zz_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null,
  email text null,
  phone text null,
  message text null,
  status text not null default 'new' check (status in ('new', 'contacted', 'converted', 'dismissed'))
);

alter table zz_leads enable row level security;

-- anyone can submit a lead (no auth required from marketing site)
create policy zz_leads_insert_anon
on zz_leads
for insert
with check (true);

-- only staff can read/update leads
create policy zz_leads_select_staff
on zz_leads
for select
using (zz_is_staff());

create policy zz_leads_update_staff
on zz_leads
for update
using (zz_is_staff())
with check (zz_is_staff());

-- ── Messages ─────────────────────────────────────────────────────
create table if not exists zz_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid not null references zz_clients (id) on delete cascade,
  sender_user_id uuid null references auth.users (id) on delete set null,
  direction text not null check (direction in ('admin_to_client', 'client_to_admin')),
  body text not null,
  read_at timestamptz null
);

alter table zz_messages enable row level security;

create policy zz_messages_select
on zz_messages
for select
using (
  zz_is_staff()
  or exists (
    select 1 from zz_clients c
    where c.id = zz_messages.client_id
      and c.user_id = auth.uid()
  )
);

create policy zz_messages_insert
on zz_messages
for insert
with check (
  zz_is_staff()
  or exists (
    select 1 from zz_clients c
    where c.id = zz_messages.client_id
      and c.user_id = auth.uid()
  )
);

-- ── Cancel codes (job cancellation confirmation) ──────────────────
create table if not exists zz_cancel_codes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid not null references zz_clients (id) on delete cascade,
  code text not null,
  expires_at timestamptz not null
);

alter table zz_cancel_codes enable row level security;

create policy zz_cancel_codes_staff
on zz_cancel_codes
for all
using (zz_is_staff())
with check (zz_is_staff());

-- ── Auto-profile trigger ──────────────────────────────────────────
-- Fires after every new auth.users row (magic link, OTP, etc.)
-- Creates a zz_profiles row (role=client) and links zz_clients by email.
create or replace function zz_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.zz_profiles (user_id, role, full_name, phone)
  values (
    new.id,
    'client',
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    null
  )
  on conflict (user_id) do nothing;

  update public.zz_clients
  set user_id = new.id
  where email = new.email
    and user_id is null;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure zz_handle_new_user();
