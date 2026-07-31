-- =====================================================================
-- Forstservice-Rechnungsprogramm — Phase 2 Migration
-- =====================================================================
-- Voraussetzung: schema.sql wurde bereits ausgeführt.
-- Ergänzt: Lieferscheine, Gutschriften, Mahnungen, Ausgaben.
-- Im Supabase SQL-Editor ausführen.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Zusätzliche Enums
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'dokument_status') then
    create type dokument_status as enum ('entwurf', 'abgeschlossen');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2) Lieferscheine
-- ---------------------------------------------------------------------
create table if not exists delivery_notes (
  id uuid primary key default gen_random_uuid(),
  nummer text unique,
  customer_id uuid not null references customers (id),
  status dokument_status not null default 'entwurf',
  lieferdatum date,
  notiz text,
  created_by uuid references profiles (id),
  abgeschlossen_von uuid references profiles (id),
  abgeschlossen_am timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists delivery_note_items (
  id uuid primary key default gen_random_uuid(),
  delivery_note_id uuid not null references delivery_notes (id) on delete cascade,
  service_id uuid references services (id),
  bezeichnung text not null,
  menge numeric(12, 2) not null default 1,
  einheit einheit_typ not null default 'pauschale',
  sortierung int not null default 0
);

-- ---------------------------------------------------------------------
-- 3) Gutschriften (können optional auf eine Rechnung verweisen)
-- ---------------------------------------------------------------------
create table if not exists credit_notes (
  id uuid primary key default gen_random_uuid(),
  nummer text unique,
  customer_id uuid not null references customers (id),
  invoice_id uuid references invoices (id),
  status invoice_status not null default 'entwurf',
  gutschriftdatum date,
  grund text,
  notiz text,
  created_by uuid references profiles (id),
  freigegeben_von uuid references profiles (id),
  freigegeben_am timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists credit_note_items (
  id uuid primary key default gen_random_uuid(),
  credit_note_id uuid not null references credit_notes (id) on delete cascade,
  service_id uuid references services (id),
  bezeichnung text not null,
  menge numeric(12, 2) not null default 1,
  einheit einheit_typ not null default 'pauschale',
  einzelpreis numeric(12, 2) not null default 0,
  ust_satz numeric(4, 2) not null default 19.00,
  sortierung int not null default 0
);

-- ---------------------------------------------------------------------
-- 4) Mahnungen (beziehen sich auf eine bereits freigegebene Rechnung)
-- ---------------------------------------------------------------------
create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id),
  mahnstufe int not null default 1 check (mahnstufe between 1 and 3),
  mahngebuehr numeric(10, 2) not null default 0,
  mahntext text,
  erstellt_von uuid references profiles (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5) Ausgaben (für die Einnahmen-Ausgaben-Übersicht)
-- ---------------------------------------------------------------------
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  bezeichnung text not null,
  kategorie text,
  betrag numeric(12, 2) not null,
  datum date not null default current_date,
  notiz text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6) Nummernkreise für Lieferscheine & Gutschriften
--    (eigene Sequenz-Tabelle, damit sie nicht mit Rechnungsnummern kollidieren)
-- ---------------------------------------------------------------------
create table if not exists delivery_note_numbering (
  jahr int primary key,
  letzte_nummer int not null default 0
);

create table if not exists credit_note_numbering (
  jahr int primary key,
  letzte_nummer int not null default 0
);

create or replace function naechste_lieferscheinnummer()
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  aktuelles_jahr int := extract(year from now());
  neue_nummer int;
begin
  insert into delivery_note_numbering (jahr, letzte_nummer)
  values (aktuelles_jahr, 0)
  on conflict (jahr) do nothing;

  update delivery_note_numbering
  set letzte_nummer = letzte_nummer + 1
  where jahr = aktuelles_jahr
  returning letzte_nummer into neue_nummer;

  return 'L-' || aktuelles_jahr || '-' || lpad(neue_nummer::text, 4, '0');
end;
$$;

create or replace function naechste_gutschriftnummer()
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  aktuelles_jahr int := extract(year from now());
  neue_nummer int;
begin
  insert into credit_note_numbering (jahr, letzte_nummer)
  values (aktuelles_jahr, 0)
  on conflict (jahr) do nothing;

  update credit_note_numbering
  set letzte_nummer = letzte_nummer + 1
  where jahr = aktuelles_jahr
  returning letzte_nummer into neue_nummer;

  return 'G-' || aktuelles_jahr || '-' || lpad(neue_nummer::text, 4, '0');
end;
$$;

-- ---------------------------------------------------------------------
-- 7) Freigabe-/Abschluss-Funktionen
-- ---------------------------------------------------------------------
create or replace function lieferschein_abschliessen(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_nummer text;
begin
  select naechste_lieferscheinnummer() into v_nummer;
  update delivery_notes
  set status = 'abgeschlossen',
      nummer = v_nummer,
      abgeschlossen_von = auth.uid(),
      abgeschlossen_am = now(),
      lieferdatum = coalesce(lieferdatum, current_date),
      updated_at = now()
  where id = p_id
    and status = 'entwurf';
end;
$$;

create or replace function gutschrift_freigeben(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_role user_role := auth_role();
  v_nummer text;
begin
  if v_role not in ('admin', 'buchhaltung') then
    raise exception 'Nur Admin oder Buchhaltung dürfen Gutschriften freigeben.';
  end if;

  select naechste_gutschriftnummer() into v_nummer;
  update credit_notes
  set status = 'freigegeben',
      nummer = v_nummer,
      freigegeben_von = auth.uid(),
      freigegeben_am = now(),
      gutschriftdatum = coalesce(gutschriftdatum, current_date),
      updated_at = now()
  where id = p_id
    and status = 'entwurf';
end;
$$;

-- ---------------------------------------------------------------------
-- 8) GoBD-Sperre für Gutschriften (analog zu invoices)
-- ---------------------------------------------------------------------
create or replace function protect_locked_credit_note()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if TG_OP = 'DELETE' then
    if OLD.status in ('freigegeben', 'bezahlt') then
      raise exception 'GoBD-Sperre: Freigegebene Gutschriften dürfen nicht gelöscht werden.';
    end if;
    return OLD;
  end if;

  if TG_OP = 'UPDATE' and OLD.status in ('freigegeben', 'bezahlt') then
    if  NEW.nummer          is distinct from OLD.nummer
     or NEW.customer_id     is distinct from OLD.customer_id
     or NEW.gutschriftdatum is distinct from OLD.gutschriftdatum
     or NEW.grund           is distinct from OLD.grund
    then
      raise exception 'GoBD-Sperre: Freigegebene Gutschriften dürfen inhaltlich nicht mehr geändert werden.';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_protect_locked_credit_note on credit_notes;
create trigger trg_protect_locked_credit_note
  before update or delete on credit_notes
  for each row execute function protect_locked_credit_note();

create or replace function protect_locked_credit_note_items()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_status invoice_status;
begin
  select status into v_status from credit_notes
  where id = coalesce(NEW.credit_note_id, OLD.credit_note_id);

  if v_status in ('freigegeben', 'bezahlt') then
    raise exception 'GoBD-Sperre: Positionen einer freigegebenen Gutschrift dürfen nicht mehr verändert werden.';
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_protect_locked_credit_note_items on credit_note_items;
create trigger trg_protect_locked_credit_note_items
  before insert or update or delete on credit_note_items
  for each row execute function protect_locked_credit_note_items();

-- Lieferscheine: nach Abschluss ebenfalls inhaltlich sperren
create or replace function protect_locked_delivery_note()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if TG_OP = 'DELETE' then
    if OLD.status = 'abgeschlossen' then
      raise exception 'Abgeschlossene Lieferscheine dürfen nicht gelöscht werden.';
    end if;
    return OLD;
  end if;

  if TG_OP = 'UPDATE' and OLD.status = 'abgeschlossen' then
    if  NEW.nummer       is distinct from OLD.nummer
     or NEW.customer_id  is distinct from OLD.customer_id
     or NEW.lieferdatum  is distinct from OLD.lieferdatum
    then
      raise exception 'Abgeschlossene Lieferscheine dürfen inhaltlich nicht mehr geändert werden.';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_protect_locked_delivery_note on delivery_notes;
create trigger trg_protect_locked_delivery_note
  before update or delete on delivery_notes
  for each row execute function protect_locked_delivery_note();

-- ---------------------------------------------------------------------
-- 9) Row Level Security für alle neuen Tabellen
-- ---------------------------------------------------------------------
alter table delivery_notes enable row level security;
alter table delivery_note_items enable row level security;
alter table credit_notes enable row level security;
alter table credit_note_items enable row level security;
alter table reminders enable row level security;
alter table expenses enable row level security;
alter table delivery_note_numbering enable row level security;
alter table credit_note_numbering enable row level security;

-- delivery_notes: alle lesen, alle anlegen; Entwürfe von allen bearbeitbar,
-- abgeschlossen nur noch lesbar (Trigger schützt zusätzlich inhaltlich)
create policy "delivery_notes_select" on delivery_notes
  for select using (auth.uid() is not null);
create policy "delivery_notes_insert" on delivery_notes
  for insert with check (auth.uid() is not null);
create policy "delivery_notes_update" on delivery_notes
  for update using (auth.uid() is not null);
create policy "delivery_notes_delete" on delivery_notes
  for delete using (auth.uid() is not null);

create policy "delivery_note_items_select" on delivery_note_items
  for select using (auth.uid() is not null);
create policy "delivery_note_items_insert" on delivery_note_items
  for insert with check (auth.uid() is not null);
create policy "delivery_note_items_update" on delivery_note_items
  for update using (auth.uid() is not null);
create policy "delivery_note_items_delete" on delivery_note_items
  for delete using (auth.uid() is not null);

-- credit_notes: lesen alle, anlegen alle, Freigabe nur admin/buchhaltung
-- (wird serverseitig über gutschrift_freigeben() erzwungen)
create policy "credit_notes_select" on credit_notes
  for select using (auth.uid() is not null);
create policy "credit_notes_insert" on credit_notes
  for insert with check (auth.uid() is not null);
create policy "credit_notes_update" on credit_notes
  for update using (
    auth_role() in ('admin', 'buchhaltung')
    or (auth_role() = 'mitarbeiter' and created_by = auth.uid() and status = 'entwurf')
  );
create policy "credit_notes_delete" on credit_notes
  for delete using (
    auth_role() in ('admin', 'buchhaltung')
    or (auth_role() = 'mitarbeiter' and created_by = auth.uid() and status = 'entwurf')
  );

create policy "credit_note_items_select" on credit_note_items
  for select using (auth.uid() is not null);
create policy "credit_note_items_insert" on credit_note_items
  for insert with check (auth.uid() is not null);
create policy "credit_note_items_update" on credit_note_items
  for update using (auth.uid() is not null);
create policy "credit_note_items_delete" on credit_note_items
  for delete using (auth.uid() is not null);

-- reminders: alle lesen, alle anlegen (kein Bearbeiten/Löschen nötig —
-- eine Mahnung ist ein historisches Dokument)
create policy "reminders_select" on reminders
  for select using (auth.uid() is not null);
create policy "reminders_insert" on reminders
  for insert with check (auth.uid() is not null);

-- expenses: alle lesen/anlegen, nur admin/buchhaltung bearbeiten/löschen
create policy "expenses_select" on expenses
  for select using (auth.uid() is not null);
create policy "expenses_insert" on expenses
  for insert with check (auth.uid() is not null);
create policy "expenses_update" on expenses
  for update using (auth_role() in ('admin', 'buchhaltung'));
create policy "expenses_delete" on expenses
  for delete using (auth_role() in ('admin', 'buchhaltung'));

-- Nummernkreise: kein direkter Zugriff, nur über die Funktionen oben
create policy "delivery_note_numbering_no_direct_access" on delivery_note_numbering
  for all using (false);
create policy "credit_note_numbering_no_direct_access" on credit_note_numbering
  for all using (false);

-- =====================================================================
-- Ende der Phase-2-Migration
-- =====================================================================
