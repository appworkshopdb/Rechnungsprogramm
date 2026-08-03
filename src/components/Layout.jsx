import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import logoUrl from '../assets/logo.svg';

const ROLLEN_LABEL = {
  admin: 'Admin',
  buchhaltung: 'Buchhaltung',
  mitarbeiter: 'Mitarbeiter',
};

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
          isActive
            ? 'bg-tanne-600 text-papier'
            : 'text-papier/70 hover:text-papier hover:bg-tanne-700'
        }`
      }
    >
      {children}
    </NavLink>
  );
}

export default function Layout() {
  const { profile, rolle, abmelden } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="no-print bg-tanne-800 border-b border-tanne-950/30">
        <div className="px-5 py-2.5 flex items-center gap-4 flex-wrap">
          {/* Logo + Firmenname */}
          <div className="flex items-center gap-2.5 shrink-0 mr-2">
            <img src={logoUrl} alt="Forstservice Elsasser Logo" className="h-8 w-auto shrink-0" />
            <span className="font-semibold text-papier text-base leading-tight tracking-tight">
              Forstservice
            </span>
          </div>

          {/* Menüpunkte horizontal */}
          <nav className="flex items-center gap-1 flex-wrap flex-1">
            <NavItem to="/rechnungen">Rechnungen</NavItem>
            <NavItem to="/lieferscheine">Lieferscheine</NavItem>
            <NavItem to="/gutschriften">Gutschriften</NavItem>
            <NavItem to="/mahnungen">Mahnungen</NavItem>
            <NavItem to="/zeiterfassung">Zeiterfassung</NavItem>
            <NavItem to="/vorlagen">Vorlagen</NavItem>
            <NavItem to="/kunden">Kunden</NavItem>
            <NavItem to="/leistungen">Leistungen</NavItem>
            <NavItem to="/ausgaben">Ausgaben</NavItem>
            <NavItem to="/uebersicht">Übersicht</NavItem>
            {rolle === 'admin' && <NavItem to="/einstellungen">Firmeneinstellungen</NavItem>}
          </nav>

          {/* Benutzer + Abmelden */}
          <div className="flex items-center gap-3 shrink-0 ml-auto">
            <div className="text-right leading-tight">
              <p className="text-sm font-medium text-papier">{profile?.full_name || 'Angemeldet'}</p>
              <p className="text-[11px] text-papier/50">{ROLLEN_LABEL[rolle] || rolle}</p>
            </div>
            <button
              onClick={abmelden}
              className="text-xs font-medium text-papier/70 hover:text-papier border border-papier/25 rounded-md px-3 py-1.5 hover:bg-tanne-700 transition-colors"
            >
              Abmelden
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
