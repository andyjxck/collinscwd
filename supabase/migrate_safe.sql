-- Safe re-run migration: creates tables + policies only if they don't exist.
-- Run this in Supabase SQL editor. Safe to run multiple times.

create extension if not exists pgcrypto;

-- ── zz_profiles ──────────────────────────────────────────
create table if not exists zz_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  role text not null check (role in ('owner', 'staff', 'client')),
  full_name text not null default '',
  phone text null
);
alter table zz_profiles enable row level security;

create or replace function zz_is_staff()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from zz_profiles p
    where p.user_id = auth.uid() and p.role in ('owner', 'staff')
  );
$$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='zz_profiles' and policyname='zz_profiles_select_own') then
    create policy zz_profiles_select_own on zz_profiles for select using (user_id = auth.uid() or zz_is_staff());
  end if;
  if not exists (select 1 from pg_policies where tablename='zz_profiles' and policyname='zz_profiles_update_own') then
    create policy zz_profiles_update_own on zz_profiles for update using (user_id = auth.uid() or zz_is_staff()) with check (user_id = auth.uid() or zz_is_staff());
  end if;
end $$;

-- ── zz_clients ──────────────────────────────────────────
create table if not exists zz_clients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid unique null references auth.users (id) on delete set null,
  full_name text not null,
  email text not null,
  phone text null
);
alter table zz_clients enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='zz_clients' and policyname='zz_clients_select') then
    create policy zz_clients_select on zz_clients for select using (zz_is_staff() or user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='zz_clients' and policyname='zz_clients_insert_staff') then
    create policy zz_clients_insert_staff on zz_clients for insert with check (zz_is_staff());
  end if;
  if not exists (select 1 from pg_policies where tablename='zz_clients' and policyname='zz_clients_update_staff') then
    create policy zz_clients_update_staff on zz_clients for update using (zz_is_staff()) with check (zz_is_staff());
  end if;
end $$;

-- ── zz_job_phases ──────────────────────────────────────────
create table if not exists zz_job_phases (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  position int not null,
  is_active boolean not null default true
);
alter table zz_job_phases enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='zz_job_phases' and policyname='zz_job_phases_read') then
    create policy zz_job_phases_read on zz_job_phases for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='zz_job_phases' and policyname='zz_job_phases_write_staff') then
    create policy zz_job_phases_write_staff on zz_job_phases for all using (zz_is_staff()) with check (zz_is_staff());
  end if;
end $$;

-- ── zz_jobs ──────────────────────────────────────────
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

do $$ begin
  if not exists (select 1 from pg_policies where tablename='zz_jobs' and policyname='zz_jobs_select') then
    create policy zz_jobs_select on zz_jobs for select using (
      zz_is_staff() or exists (
        select 1 from zz_clients c where c.id = zz_jobs.client_id and c.user_id = auth.uid()
      )
    );
  end if;
  if not exists (select 1 from pg_policies where tablename='zz_jobs' and policyname='zz_jobs_insert_staff') then
    create policy zz_jobs_insert_staff on zz_jobs for insert with check (zz_is_staff());
  end if;
  if not exists (select 1 from pg_policies where tablename='zz_jobs' and policyname='zz_jobs_update_staff') then
    create policy zz_jobs_update_staff on zz_jobs for update using (zz_is_staff()) with check (zz_is_staff());
  end if;
end $$;

-- ── zz_job_notes ──────────────────────────────────────────
create table if not exists zz_job_notes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  job_id uuid not null references zz_jobs (id) on delete cascade,
  author_user_id uuid null references auth.users (id) on delete set null,
  is_client_visible boolean not null default false,
  body text not null
);
alter table zz_job_notes enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='zz_job_notes' and policyname='zz_job_notes_select') then
    create policy zz_job_notes_select on zz_job_notes for select using (
      zz_is_staff() or (
        is_client_visible = true and exists (
          select 1 from zz_jobs j join zz_clients c on c.id = j.client_id
          where j.id = zz_job_notes.job_id and c.user_id = auth.uid()
        )
      )
    );
  end if;
  if not exists (select 1 from pg_policies where tablename='zz_job_notes' and policyname='zz_job_notes_insert_staff') then
    create policy zz_job_notes_insert_staff on zz_job_notes for insert with check (zz_is_staff());
  end if;
  if not exists (select 1 from pg_policies where tablename='zz_job_notes' and policyname='zz_job_notes_update_staff') then
    create policy zz_job_notes_update_staff on zz_job_notes for update using (zz_is_staff()) with check (zz_is_staff());
  end if;
end $$;

-- ── zz_activity_events ──────────────────────────────────────────
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

do $$ begin
  if not exists (select 1 from pg_policies where tablename='zz_activity_events' and policyname='zz_activity_events_select') then
    create policy zz_activity_events_select on zz_activity_events for select using (
      zz_is_staff() or (
        is_client_visible = true and exists (
          select 1 from zz_jobs j join zz_clients c on c.id = j.client_id
          where j.id = zz_activity_events.job_id and c.user_id = auth.uid()
        )
      )
    );
  end if;
  if not exists (select 1 from pg_policies where tablename='zz_activity_events' and policyname='zz_activity_events_insert_staff') then
    create policy zz_activity_events_insert_staff on zz_activity_events for insert with check (zz_is_staff());
  end if;
end $$;

-- ── zz_files ──────────────────────────────────────────
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
  is_client_visible boolean not null default false
);
alter table zz_files enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='zz_files' and policyname='zz_files_select') then
    create policy zz_files_select on zz_files for select using (
      zz_is_staff() or (
        is_client_visible = true and exists (
          select 1 from zz_jobs j join zz_clients c on c.id = j.client_id
          where j.id = zz_files.job_id and c.user_id = auth.uid()
        )
      )
    );
  end if;
  if not exists (select 1 from pg_policies where tablename='zz_files' and policyname='zz_files_insert_staff') then
    create policy zz_files_insert_staff on zz_files for insert with check (zz_is_staff());
  end if;
end $$;

-- ── zz_quotes ──────────────────────────────────────────
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

do $$ begin
  if not exists (select 1 from pg_policies where tablename='zz_quotes' and policyname='zz_quotes_select') then
    create policy zz_quotes_select on zz_quotes for select using (
      zz_is_staff() or exists (
        select 1 from zz_jobs j join zz_clients c on c.id = j.client_id
        where j.id = zz_quotes.job_id and c.user_id = auth.uid()
      )
    );
  end if;
  if not exists (select 1 from pg_policies where tablename='zz_quotes' and policyname='zz_quotes_write_staff') then
    create policy zz_quotes_write_staff on zz_quotes for all using (zz_is_staff()) with check (zz_is_staff());
  end if;
end $$;

-- ── zz_quote_items ──────────────────────────────────────────
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

do $$ begin
  if not exists (select 1 from pg_policies where tablename='zz_quote_items' and policyname='zz_quote_items_select') then
    create policy zz_quote_items_select on zz_quote_items for select using (
      exists (
        select 1 from zz_quotes q where q.id = zz_quote_items.quote_id and (
          zz_is_staff() or exists (
            select 1 from zz_jobs j join zz_clients c on c.id = j.client_id
            where j.id = q.job_id and c.user_id = auth.uid()
          )
        )
      )
    );
  end if;
  if not exists (select 1 from pg_policies where tablename='zz_quote_items' and policyname='zz_quote_items_write_staff') then
    create policy zz_quote_items_write_staff on zz_quote_items for all using (zz_is_staff()) with check (zz_is_staff());
  end if;
end $$;

-- ── zz_invoices ──────────────────────────────────────────
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

do $$ begin
  if not exists (select 1 from pg_policies where tablename='zz_invoices' and policyname='zz_invoices_select') then
    create policy zz_invoices_select on zz_invoices for select using (
      zz_is_staff() or exists (
        select 1 from zz_jobs j join zz_clients c on c.id = j.client_id
        where j.id = zz_invoices.job_id and c.user_id = auth.uid()
      )
    );
  end if;
  if not exists (select 1 from pg_policies where tablename='zz_invoices' and policyname='zz_invoices_write_staff') then
    create policy zz_invoices_write_staff on zz_invoices for all using (zz_is_staff()) with check (zz_is_staff());
  end if;
end $$;

-- ── zz_invoice_items ──────────────────────────────────────────
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

do $$ begin
  if not exists (select 1 from pg_policies where tablename='zz_invoice_items' and policyname='zz_invoice_items_select') then
    create policy zz_invoice_items_select on zz_invoice_items for select using (
      exists (
        select 1 from zz_invoices i where i.id = zz_invoice_items.invoice_id and (
          zz_is_staff() or exists (
            select 1 from zz_jobs j join zz_clients c on c.id = j.client_id
            where j.id = i.job_id and c.user_id = auth.uid()
          )
        )
      )
    );
  end if;
  if not exists (select 1 from pg_policies where tablename='zz_invoice_items' and policyname='zz_invoice_items_write_staff') then
    create policy zz_invoice_items_write_staff on zz_invoice_items for all using (zz_is_staff()) with check (zz_is_staff());
  end if;
end $$;

-- ── Seed default phases (skip if already seeded) ──────────────
insert into zz_job_phases (name, position, is_active)
select name, position, true
from (values
  ('Lead received',    1),
  ('Quote sent',       2),
  ('Quote accepted',   3),
  ('Survey booked',    4),
  ('Survey complete',  5),
  ('Installation',     6),
  ('Snagging',         7),
  ('Completed',        8)
) as v(name, position)
where not exists (select 1 from zz_job_phases limit 1);
