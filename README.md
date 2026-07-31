# Forstservice Rechnungsprogramm

Internes Rechnungsprogramm für den Forstservice. React/Vite-Frontend,
Supabase als Datenbank/Auth/Storage, Deploy über Netlify.

## Lokale Entwicklung

```bash
npm install
npm run dev
```

Die App läuft dann unter `http://localhost:5173`.

Die Datei `.env` enthält bereits die Zugangsdaten zu eurem Supabase-Projekt
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Diese Datei ist über
`.gitignore` bewusst vom Git-Repository ausgeschlossen — sie landet also
nicht auf GitHub. Als Vorlage für neue Umgebungen dient `.env.example`.

## Datenbank-Schema

Liegt in `supabase/schema.sql` (Phase 1: Kunden, Leistungen, Vorlagen,
Rechnungen) und `supabase/migration_phase2.sql` (Phase 2: Lieferscheine,
Gutschriften, Mahnungen, Ausgaben). Beide im Supabase SQL-Editor
**in dieser Reihenfolge** einmalig ausführen, bevor die App benutzt wird.

Erster Nutzer bekommt automatisch die Rolle `mitarbeiter`. Um jemanden zum
Admin zu machen:

```sql
update profiles set role = 'admin' where id = '<user-uuid>';
```

## Deploy auf GitHub Pages

Die App wird komplett über GitHub gehostet — kein weiterer Anbieter nötig.
Ein GitHub-Actions-Workflow (`.github/workflows/deploy.yml`) baut die App
bei jedem Push auf `main` automatisch und veröffentlicht sie auf GitHub
Pages.

**Einmalige Einrichtung:**

1. Repo auf GitHub anlegen und diesen Ordner hochladen:
   ```bash
   git init
   git add -A
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/DEIN-USERNAME/DEIN-REPO.git
   git push -u origin main
   ```
2. Im Repo unter **Settings → Pages** bei "Build and deployment" als
   Quelle **"GitHub Actions"** auswählen (nicht "Deploy from a branch").
3. Im Repo unter **Settings → Secrets and variables → Actions → New
   repository secret** zwei Secrets anlegen (gleiche Werte wie in eurer
   lokalen `.env`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Bei jedem Push auf `main` läuft der Workflow automatisch (sichtbar
   unter dem Reiter **Actions** im Repo). Nach ein bis zwei Minuten ist
   die App unter `https://DEIN-USERNAME.github.io/DEIN-REPO/` erreichbar.

**Hinweis zu privaten Repos:** GitHub Pages für private Repositories
setzt einen kostenpflichtigen GitHub-Plan (Pro/Team) voraus. Mit einem
öffentlichen Repo funktioniert es auch im kostenlosen Tarif — das ist
unbedenklich, da im Frontend ohnehin nur der öffentliche Anon-Key
verwendet wird und der eigentliche Datenzugriff über Supabase Row Level
Security abgesichert ist, nicht über die Geheimhaltung des Repos.

**Routing-Hinweis:** Die App nutzt bewusst `HashRouter` (Adressen wie
`.../#/rechnungen`), da GitHub Pages als reines Static Hosting sonst bei
direktem Aufruf einer Unterseite einen 404-Fehler zeigen würde.

## Rollen

| Rolle | Darf |
|---|---|
| `mitarbeiter` | Kunden/Leistungen anlegen, eigene Rechnungsentwürfe erstellen/bearbeiten |
| `buchhaltung` | zusätzlich: Rechnungen freigeben, als bezahlt markieren |
| `admin` | zusätzlich: Nutzerrollen verwalten |

## Rechnungs-Workflow

1. Rechnung wird als **Entwurf** angelegt (von jeder Rolle).
2. Admin/Buchhaltung **gibt frei** → Rechnungsnummer wird automatisch
   vergeben, Rechnung wird inhaltlich gesperrt (GoBD-Konformität, per
   Datenbank-Trigger durchgesetzt).
3. Export erfolgt über **Drucken / Als PDF speichern** (Browser-Druckdialog
   → "Als PDF speichern"). Versand ist bewusst manuell (Download + eigener
   E-Mail-Versand), kein automatisierter Versanddienst im MVP.
4. Nach Zahlungseingang manuell als **bezahlt** markieren.

## Phase 2 – neu hinzugekommen

- **Lieferscheine** (`/lieferscheine`) – Nachweis erbrachter Leistungen ohne
  Preise, mit eigenem Nummernkreis (`L-2026-0001`), lassen sich direkt in
  eine Rechnung übernehmen.
- **Gutschriften** (`/gutschriften`) – analog zu Rechnungen, optional mit
  Bezug auf eine bestehende Rechnung, eigener Nummernkreis (`G-2026-0001`),
  gleiche GoBD-Sperre nach Freigabe.
- **Mahnungen** (`/mahnungen`) – Liste offener (freigegebener, nicht
  bezahlter) Rechnungen, Mahnstufe 1–3 mit vorausgefülltem Text und
  Mahngebühr, Speichern + Drucken. Versand bleibt bewusst manuell.
- **Ausgaben** (`/ausgaben`) – einfache Erfassung von Betriebsausgaben.
- **Übersicht** (`/uebersicht`) – Einnahmen (bezahlte Rechnungen, netto) vs.
  Ausgaben nach Monat für ein wählbares Jahr, inkl. CSV-Export.
- **CSV-Export** auf den Seiten Kunden, Rechnungen und Übersicht.

## Bekannte Grenzen (weiterhin offen)

- Kein automatisierter E-Mail-Versand oder automatisierte
  Zahlungserinnerungen — Mahnungen werden manuell ausgelöst.
- XRechnung-XML-Export ist noch nicht implementiert.
- PDF-Export läuft über den Browser-Druckdialog, nicht über eine dedizierte
  PDF-Bibliothek.
