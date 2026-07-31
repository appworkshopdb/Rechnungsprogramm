-- =====================================================================
-- Forstservice-Rechnungsprogramm — Phase 3 Migration
-- =====================================================================
-- Voraussetzung: schema.sql und migration_phase2.sql wurden bereits
-- ausgeführt. Ergänzt: Firmeneinstellungen, Zeiterfassung.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Firmeneinstellungen (genau eine Zeile, id fest = 1)
-- ---------------------------------------------------------------------
create table if not exists company_settings (
  id int primary key default 1,
  firmenname text not null default 'Forstservice',
  strasse text,
  plz text,
  ort text,
  land text not null default 'Deutschland',
  telefon text,
  email text,
  ust_idnr text,          -- USt-IdNr., z.B. DE123456789
  steuernummer text,
  iban text,
  bic text,
  constraint nur_eine_zeile check (id = 1)
);

insert into company_settings (id) values (1) on conflict (id) do nothing;

alter table company_settings enable row level security;

create policy "company_settings_select" on company_settings
  for select using (auth.uid() is not null);

create policy "company_settings_update_admin" on company_settings
  for update using (auth_role() = 'admin');

-- ---------------------------------------------------------------------
-- 2) Zeiterfassung
-- ---------------------------------------------------------------------
create table if not exists time_entries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers (id),
  service_id uuid references services (id),
  mitarbeiter_id uuid references profiles (id),
  datum date not null default current_date,
  stunden numeric(6, 2) not null,
  beschreibung text,
  abgerechnet boolean not null default false,
  invoice_id uuid references invoices (id),  -- gesetzt, sobald abgerechnet
  created_at timestamptz not null default now()
);

alter table time_entries enable row level security;

create policy "time_entries_select" on time_entries
  for select using (auth.uid() is not null);

create policy "time_entries_insert" on time_entries
  for insert with check (auth.uid() is not null);

create policy "time_entries_update" on time_entries
  for update using (
    auth_role() in ('admin', 'buchhaltung')
    or (auth_role() = 'mitarbeiter' and mitarbeiter_id = auth.uid() and not abgerechnet)
  );

create policy "time_entries_delete" on time_entries
  for delete using (
    auth_role() in ('admin', 'buchhaltung')
    or (auth_role() = 'mitarbeiter' and mitarbeiter_id = auth.uid() and not abgerechnet)
  );

-- =====================================================================
-- Ende der Phase-3-Migration
-- =====================================================================
