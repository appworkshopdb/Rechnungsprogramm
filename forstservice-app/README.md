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

Liegt in `supabase/schema.sql`. Im Supabase SQL-Editor einmalig ausführen,
bevor die App benutzt wird (siehe Kommentare in der Datei).

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

## Bekannte Grenzen des MVP

- Kein automatisierter E-Mail-Versand oder Zahlungserinnerungen.
- XRechnung-XML-Export ist noch nicht implementiert (geplant für die
  nächste Phase, siehe Projektplan).
- PDF-Export läuft aktuell über den Browser-Druckdialog, nicht über eine
  dedizierte PDF-Bibliothek — funktional, aber layoutmäßig noch schlicht.
