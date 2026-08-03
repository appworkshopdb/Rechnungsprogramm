import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [menuOffen, setMenuOffen] = useState(false);
  const menuRef = useRef(null);

  // Dropdown schließen, wenn außerhalb geklickt wird
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOffen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Obere helle Leiste: Logo + Firmenname links, Angemeldet-Info + Zahnrad rechts */}
      <header className="no-print bg-white border-b border-tanne-900/10">
        <div className="px-5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={logoUrl} alt="Forstservice Elsasser Logo" className="h-9 w-auto shrink-0" />
            <span className="font-semibold text-tanne-900 text-lg leading-tight tracking-tight">
              Forstservice
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-sm font-medium text-tanne-900">{profile?.full_name || 'Angemeldet'}</p>
              <p className="text-[11px] text-tanne-700/60">{ROLLEN_LABEL[rolle] || rolle}</p>
            </div>

            {/* Zahnrad-Dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOffen((o) => !o)}
                className="flex items-center justify-center h-9 w-9 rounded-lg text-tanne-700 hover:bg-tanne-900/5 transition-colors"
                aria-label="Einstellungen"
                title="Einstellungen"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>

              {menuOffen && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-lg shadow-lg border border-tanne-900/10 py-1 z-30">
                  {rolle === 'admin' && (
                    <button
                      onClick={() => {
                        setMenuOffen(false);
                        navigate('/einstellungen');
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-tanne-900 hover:bg-tanne-900/5 transition-colors"
                    >
                      Firmeneinstellungen
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setMenuOffen(false);
                      abmelden();
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-rost hover:bg-rost/5 transition-colors"
                  >
                    Abmelden
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Untere dunkle Menüleiste mit allen Menüpunkten */}
      <nav className="no-print bg-tanne-800 border-b border-tanne-950/30">
        <div className="px-5 py-2 flex items-center gap-1 flex-wrap">
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
        </div>
      </nav>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
