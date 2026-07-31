import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

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
        `block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-tanne-800 text-papier'
            : 'text-tanne-900/80 hover:bg-tanne-900/5'
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
    <div className="min-h-screen flex">
      <aside className="no-print w-60 shrink-0 border-r border-tanne-900/10 bg-white/60 flex flex-col">
        <div className="px-4 py-5 border-b border-tanne-900/10">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-tanne-800 text-papier flex items-center justify-center font-display text-sm">
              F
            </div>
            <div>
              <p className="font-display font-semibold text-tanne-900 leading-tight">Forstservice</p>
              <p className="text-[11px] text-tanne-700/60 leading-tight">Rechnungsprogramm</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
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

        <div className="px-4 py-4 border-t border-tanne-900/10">
          <p className="text-sm font-medium text-tanne-900">{profile?.full_name || 'Angemeldet'}</p>
          <p className="text-xs text-tanne-700/60 mb-3">{ROLLEN_LABEL[rolle] || rolle}</p>
          <button
            onClick={abmelden}
            className="text-xs font-medium text-rost hover:underline"
          >
            Abmelden
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
