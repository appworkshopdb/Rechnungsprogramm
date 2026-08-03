import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import logoUrl from '../assets/logo.svg';

export default function Login() {
  const [email, setEmail] = useState('');
  const [passwort, setPasswort] = useState('');
  const [fehler, setFehler] = useState(null);
  const [ladeVorgang, setLadeVorgang] = useState(false);

  async function anmelden(e) {
    e.preventDefault();
    setFehler(null);
    setLadeVorgang(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: passwort });
    setLadeVorgang(false);
    if (error) setFehler('Anmeldung fehlgeschlagen: E-Mail oder Passwort prüfen.');
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src={logoUrl} alt="Forstservice Elsasser Logo" className="h-16 w-auto mx-auto mb-4" />
          <h1 className="font-display text-2xl font-semibold text-tanne-900">
            Forstservice
          </h1>
          <p className="text-sm text-tanne-700/70 mt-1">Anmeldung zum Rechnungsprogramm</p>
        </div>

        <form onSubmit={anmelden} className="bg-white/70 border border-tanne-900/10 rounded-xl p-6 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium text-tanne-900 mb-1" htmlFor="email">
              E-Mail
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-tanne-900/15 bg-papier px-3 py-2 text-sm focus:border-tanne-600"
              placeholder="name@firma.de"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-tanne-900 mb-1" htmlFor="passwort">
              Passwort
            </label>
            <input
              id="passwort"
              type="password"
              required
              value={passwort}
              onChange={(e) => setPasswort(e.target.value)}
              className="w-full rounded-lg border border-tanne-900/15 bg-papier px-3 py-2 text-sm focus:border-tanne-600"
              placeholder="••••••••"
            />
          </div>

          {fehler && (
            <p className="text-sm text-rost bg-rost/10 border border-rost/20 rounded-lg px-3 py-2">
              {fehler}
            </p>
          )}

          <button
            type="submit"
            disabled={ladeVorgang}
            className="w-full rounded-lg bg-tanne-800 text-papier font-medium py-2.5 hover:bg-tanne-700 transition-colors disabled:opacity-60"
          >
            {ladeVorgang ? 'Anmeldung läuft…' : 'Anmelden'}
          </button>
        </form>

        <p className="text-xs text-tanne-700/60 text-center mt-6">
          Neue Nutzer werden über das Supabase-Dashboard angelegt und erhalten
          anschließend eine Rolle durch einen Administrator.
        </p>
      </div>
    </div>
  );
}
