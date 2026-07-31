-- =====================================================================
-- Forstservice-Rechnungsprogramm — Supabase-Datenbankschema
-- =====================================================================
-- Ausführen im Supabase SQL-Editor (Project > SQL Editor > New query).
-- Reihenfolge ist wichtig: Erweiterungen -> Tabellen -> Funktionen ->
-- Trigger -> Row Level Security.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) Erweiterungen
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- für gen_random_uuid()

-- ---------------------------------------------------------------------
-- 1) Rollen-Enum
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('admin', 'buchhaltung', 'mitarbeiter');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'kunden_typ') then
    create type kunden_typ as enum ('privat', 'oeffentlich');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'einheit_typ') then
    create type einheit_typ as enum ('stunde', 'tag', 'festmeter', 'pauschale', 'km', 'stueck', 'frei');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'invoice_status') then
    create type invoice_status as enum ('entwurf', 'freigegeben', 'bezahlt', 'storniert');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2) Profiles (erweitert auth.users um Rolle & Name)
-- ---------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role user_role not null default 'mitarbeiter',
  created_at timestamptz not null default now()
);

-- Bei jedem neuen Supabase-Auth-User automatisch ein Profil anlegen
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data ->> 'full_name', 'mitarbeiter');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Hilfsfunktion: Rolle des aktuell eingeloggten Nutzers
create or replace function auth_role()
returns user_role
language sql
stable
security definer set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- 3) Kunden
-- ---------------------------------------------------------------------
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kundentyp kunden_typ not null default 'privat',
  leitweg_id text,                 -- Pflichtangabe bei manchen öffentlichen Auftraggebern
  strasse text,
  plz text,
  ort text,
  email text,
  telefon text,
  notiz text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4) Leistungen / Artikel (flexible Einheiten für gemischte Abrechnung)
-- ---------------------------------------------------------------------
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  bezeichnung text not null,
  beschreibung text,
  einheit einheit_typ not null default 'pauschale',
  standardpreis numeric(12, 2),
  ust_satz numeric(4, 2) not null default 19.00,
  aktiv boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5) Rechnungsvorlagen
-- ---------------------------------------------------------------------
create table if not exists invoice_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,                          -- z.B. "Standard Holzernte Gemeinde X"
  customer_id uuid references customers (id),  -- optional: an einen Kunden gebunden
  standardtext text,                            -- z.B. Einleitungstext der Rechnung
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create table if not exists invoice_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references invoice_templates (id) on delete cascade,
  service_id uuid references services (id),
  bezeichnung text not null,
  menge numeric(12, 2) not null default 1,
  einheit einheit_typ not null default 'pauschale',
  einzelpreis numeric(12, 2) not null default 0,
  sortierung int not null default 0
);

-- ---------------------------------------------------------------------
-- 6) Nummernkreis für Rechnungsnummern (z.B. 2026-0001)
-- ---------------------------------------------------------------------
create table if not exists numbering_sequences (
  jahr int primary key,
  letzte_nummer int not null default 0
);

create or replace function naechste_rechnungsnummer()
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  aktuelles_jahr int := extract(year from now());
  neue_nummer int;
begin
  insert into numbering_sequences (jahr, letzte_nummer)
  values (aktuelles_jahr, 0)
  on conflict (jahr) do nothing;

  update numbering_sequences
  set letzte_nummer = letzte_nummer + 1
  where jahr = aktuelles_jahr
  returning letzte_nummer into neue_nummer;

  return aktuelles_jahr || '-' || lpad(neue_nummer::text, 4, '0');
end;
$$;

-- ---------------------------------------------------------------------
-- 7) Rechnungen
-- ---------------------------------------------------------------------
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  nummer text unique,                       -- wird beim Freigeben vergeben, nicht beim Anlegen
  customer_id uuid not null references customers (id),
  status invoice_status not null default 'entwurf',
  rechnungsdatum date,                      -- bewusst nullable, kein Zwang zu exaktem Datum
  leistungszeitraum_von date,
  leistungszeitraum_bis date,
  notiz text,
  template_id uuid references invoice_templates (id),
  created_by uuid references profiles (id),
  freigegeben_von uuid references profiles (id),
  freigegeben_am timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete cascade,
  service_id uuid references services (id),
  bezeichnung text not null,
  menge numeric(12, 2) not null default 1,
  einheit einheit_typ not null default 'pauschale',
  einzelpreis numeric(12, 2) not null default 0,
  ust_satz numeric(4, 2) not null default 19.00,
  sortierung int not null default 0
);

-- ---------------------------------------------------------------------
-- 8) Audit-Log (GoBD-Nachvollziehbarkeit)
-- ---------------------------------------------------------------------
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  tabelle text not null,
  datensatz_id uuid not null,
  aktion text not null,          -- z.B. 'INSERT', 'UPDATE', 'FREIGABE', 'STORNIERT'
  benutzer_id uuid references profiles (id),
  alte_werte jsonb,
  neue_werte jsonb,
  created_at timestamptz not null default now()
);

create or replace function log_audit(
  p_tabelle text,
  p_datensatz_id uuid,
  p_aktion text,
  p_alte_werte jsonb,
  p_neue_werte jsonb
) returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into audit_log (tabelle, datensatz_id, aktion, benutzer_id, alte_werte, neue_werte)
  values (p_tabelle, p_datensatz_id, p_aktion, auth.uid(), p_alte_werte, p_neue_werte);
end;
$$;

-- ---------------------------------------------------------------------
-- 9) GoBD-Sperre: freigegebene/bezahlte Rechnungen dürfen nicht mehr
--    inhaltlich verändert oder gelöscht werden.
-- ---------------------------------------------------------------------
create or replace function protect_locked_invoice()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Löschen einer freigegebenen/bezahlten Rechnung verhindern
  if TG_OP = 'DELETE' then
    if OLD.status in ('freigegeben', 'bezahlt') then
      raise exception 'GoBD-Sperre: Freigegebene oder bezahlte Rechnungen dürfen nicht gelöscht werden.';
    end if;
    return OLD;
  end if;

  -- Inhaltliche Änderung einer bereits freigegebenen Rechnung verhindern.
  -- Erlaubt bleibt ausschließlich der Statuswechsel freigegeben -> bezahlt/storniert
  -- sowie das Setzen von freigegeben_von/freigegeben_am beim Freigeben selbst.
  if TG_OP = 'UPDATE' and OLD.status in ('freigegeben', 'bezahlt') then
    if  NEW.nummer                  is distinct from OLD.nummer
     or NEW.customer_id             is distinct from OLD.customer_id
     or NEW.rechnungsdatum          is distinct from OLD.rechnungsdatum
     or NEW.leistungszeitraum_von   is distinct from OLD.leistungszeitraum_von
     or NEW.leistungszeitraum_bis   is distinct from OLD.leistungszeitraum_bis
     or NEW.notiz                   is distinct from OLD.notiz
    then
      raise exception 'GoBD-Sperre: Freigegebene Rechnungen dürfen inhaltlich nicht mehr geändert werden.';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_protect_locked_invoice on invoices;
create trigger trg_protect_locked_invoice
  before update or delete on invoices
  for each row execute function protect_locked_invoice();

-- Positionen (invoice_items) einer gesperrten Rechnung ebenfalls schützen
create or replace function protect_locked_invoice_items()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_status invoice_status;
begin
  select status into v_status from invoices
  where id = coalesce(NEW.invoice_id, OLD.invoice_id);

  if v_status in ('freigegeben', 'bezahlt') then
    raise exception 'GoBD-Sperre: Positionen einer freigegebenen Rechnung dürfen nicht mehr verändert werden.';
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_protect_locked_invoice_items on invoice_items;
create trigger trg_protect_locked_invoice_items
  before insert or update or delete on invoice_items
  for each row execute function protect_locked_invoice_items();

-- ---------------------------------------------------------------------
-- 10) Rechnung freigeben (vergibt Nummer, setzt Status, schreibt Audit-Log)
--     Nur admin/buchhaltung dürfen das (siehe RLS + Rollen-Check unten).
-- ---------------------------------------------------------------------
create or replace function rechnung_freigeben(p_invoice_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_role user_role := auth_role();
  v_nummer text;
begin
  if v_role not in ('admin', 'buchhaltung') then
    raise exception 'Nur Admin oder Buchhaltung dürfen Rechnungen freigeben.';
  end if;

  select naechste_rechnungsnummer() into v_nummer;

  update invoices
  set status = 'freigegeben',
      nummer = v_nummer,
      freigegeben_von = auth.uid(),
      freigegeben_am = now(),
      rechnungsdatum = coalesce(rechnungsdatum, current_date),
      updated_at = now()
  where id = p_invoice_id
    and status = 'entwurf';

  perform log_audit('invoices', p_invoice_id, 'FREIGABE', null, jsonb_build_object('nummer', v_nummer));
end;
$$;

-- ---------------------------------------------------------------------
-- 11) Row Level Security aktivieren
-- ---------------------------------------------------------------------
alter table profiles enable row level security;
alter table customers enable row level security;
alter table services enable row level security;
alter table invoice_templates enable row level security;
alter table invoice_template_items enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table audit_log enable row level security;
alter table numbering_sequences enable row level security;

-- profiles: jeder eingeloggte Nutzer darf alle Profile lesen (kleine Firma,
-- Namen für "freigegeben von" etc. werden angezeigt), aber nur admin darf
-- Rollen ändern.
create policy "profiles_select_all" on profiles
  for select using (auth.uid() is not null);

create policy "profiles_update_admin_only" on profiles
  for update using (auth_role() = 'admin');

-- customers: alle eingeloggten Mitarbeiter dürfen lesen/anlegen/bearbeiten
create policy "customers_select" on customers
  for select using (auth.uid() is not null);
create policy "customers_insert" on customers
  for insert with check (auth.uid() is not null);
create policy "customers_update" on customers
  for update using (auth.uid() is not null);
create policy "customers_delete_admin_buchhaltung" on customers
  for delete using (auth_role() in ('admin', 'buchhaltung'));

-- services: gleiche Logik wie customers
create policy "services_select" on services
  for select using (auth.uid() is not null);
create policy "services_insert" on services
  for insert with check (auth.uid() is not null);
create policy "services_update" on services
  for update using (auth.uid() is not null);
create policy "services_delete_admin_buchhaltung" on services
  for delete using (auth_role() in ('admin', 'buchhaltung'));

-- invoice_templates / invoice_template_items: alle dürfen lesen & anlegen
create policy "templates_select" on invoice_templates
  for select using (auth.uid() is not null);
create policy "templates_insert" on invoice_templates
  for insert with check (auth.uid() is not null);
create policy "templates_update" on invoice_templates
  for update using (auth.uid() is not null);
create policy "templates_delete_admin_buchhaltung" on invoice_templates
  for delete using (auth_role() in ('admin', 'buchhaltung'));

create policy "template_items_select" on invoice_template_items
  for select using (auth.uid() is not null);
create policy "template_items_insert" on invoice_template_items
  for insert with check (auth.uid() is not null);
create policy "template_items_update" on invoice_template_items
  for update using (auth.uid() is not null);
create policy "template_items_delete" on invoice_template_items
  for delete using (auth.uid() is not null);

-- invoices: alle dürfen lesen; alle dürfen Entwürfe anlegen;
-- nur eigene Entwürfe (oder admin/buchhaltung) dürfen bearbeitet/gelöscht
-- werden — die GoBD-Sperre (Trigger) verhindert zusätzlich jede
-- inhaltliche Änderung nach Freigabe, unabhängig von der Rolle.
create policy "invoices_select" on invoices
  for select using (auth.uid() is not null);

create policy "invoices_insert" on invoices
  for insert with check (auth.uid() is not null);

create policy "invoices_update" on invoices
  for update using (
    auth_role() in ('admin', 'buchhaltung')
    or (auth_role() = 'mitarbeiter' and created_by = auth.uid() and status = 'entwurf')
  );

create policy "invoices_delete" on invoices
  for delete using (
    auth_role() in ('admin', 'buchhaltung')
    or (auth_role() = 'mitarbeiter' and created_by = auth.uid() and status = 'entwurf')
  );

-- invoice_items: Zugriffslogik folgt der zugehörigen Rechnung
create policy "invoice_items_select" on invoice_items
  for select using (auth.uid() is not null);

create policy "invoice_items_insert" on invoice_items
  for insert with check (
    exists (
      select 1 from invoices i
      where i.id = invoice_id
        and (
          auth_role() in ('admin', 'buchhaltung')
          or (auth_role() = 'mitarbeiter' and i.created_by = auth.uid() and i.status = 'entwurf')
        )
    )
  );

create policy "invoice_items_update" on invoice_items
  for update using (
    exists (
      select 1 from invoices i
      where i.id = invoice_id
        and (
          auth_role() in ('admin', 'buchhaltung')
          or (auth_role() = 'mitarbeiter' and i.created_by = auth.uid() and i.status = 'entwurf')
        )
    )
  );

create policy "invoice_items_delete" on invoice_items
  for delete using (
    exists (
      select 1 from invoices i
      where i.id = invoice_id
        and (
          auth_role() in ('admin', 'buchhaltung')
          or (auth_role() = 'mitarbeiter' and i.created_by = auth.uid() and i.status = 'entwurf')
        )
    )
  );

-- audit_log: nur lesend für admin/buchhaltung, Schreiben nur über
-- security-definer-Funktion log_audit() (kein direktes Insert von außen)
create policy "audit_log_select_admin_buchhaltung" on audit_log
  for select using (auth_role() in ('admin', 'buchhaltung'));

-- numbering_sequences: nur intern über naechste_rechnungsnummer() genutzt,
-- kein direkter Zugriff von außen nötig
create policy "numbering_sequences_no_direct_access" on numbering_sequences
  for all using (false);

-- =====================================================================
-- Ende des Schemas
-- =====================================================================
