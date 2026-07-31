import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';

export default function CompanySettingsPage() {
  const { rolle } = useAuth();
  const [daten, setDaten] = useState(null);
  const [ladeVorgang, setLadeVorgang] = useState(true);
  const [speichertGerade, setSpeichertGerade] = useState(false);
  const [fehler, setFehler] = useState(null);
  const [hinweis, setHinweis] = useState(null);

  useEffect(() => {
    supabase
      .from('company_settings')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        setDaten(data);
        setLadeVorgang(false);
      });
  }, []);

  async function speichern(e) {
    e.preventDefault();
    setFehler(null);
    setHinweis(null);
    setSpeichertGerade(true);

    const { error } = await supabase
      .from('company_settings')
      .update({
        firmenname: daten.firmenname,
        strasse: daten.strasse,
        plz: daten.plz,
        ort: daten.ort,
        land: daten.land,
        telefon: daten.telefon,
        email: daten.email,
        ust_idnr: daten.ust_idnr,
        steuernummer: daten.steuernummer,
        iban: daten.iban,
        bic: daten.bic,
      })
      .eq('id', 1);

    setSpeichertGerade(false);
    if (error) {
      setFehler('Speichern fehlgeschlagen: ' + error.message);
      return;
    }
    setHinweis('Gespeichert.');
  }

  if (ladeVorgang) return <div className="p-8 text-sm text-tanne-700/60">Lade…</div>;

  if (rolle !== 'admin') {
    return (
      <div className="p-8 max-w-2xl">
        <h1 className="font-display text-2xl font-semibold text-tanne-900 mb-2">Firmeneinstellungen</h1>
        <p className="text-sm text-tanne-700/70">
          Nur Admins können die Firmeneinstellungen bearbeiten. Aktuelle Daten:
        </p>
        <div className="mt-4 text-sm text-tanne-900/90 space-y-1">
          <p>{daten.firmenname}</p>
          <p>{daten.strasse}</p>
          <p>{daten.plz} {daten.ort}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="font-display text-2xl font-semibold text-tanne-900 mb-1">Firmeneinstellungen</h1>
      <p className="text-sm text-tanne-700/70 mb-6">
        Erscheint auf Rechnungen, Lieferscheinen und im XRechnung-Export
      </p>

      <form onSubmit={speichern} className="space-y-4 bg-white/60 border border-tanne-900/10 rounded-xl p-6">
        <div>
          <label className="block text-xs font-medium text-tanne-900 mb-1">Firmenname *</label>
          <input
            required
            value={daten.firmenname || ''}
            onChange={(e) => setDaten({ ...daten, firmenname: e.target.value })}
            className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-tanne-900 mb-1">Straße</label>
            <input
              value={daten.strasse || ''}
              onChange={(e) => setDaten({ ...daten, strasse: e.target.value })}
              className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-tanne-900 mb-1">PLZ</label>
            <input
              value={daten.plz || ''}
              onChange={(e) => setDaten({ ...daten, plz: e.target.value })}
              className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-tanne-900 mb-1">Ort</label>
            <input
              value={daten.ort || ''}
              onChange={(e) => setDaten({ ...daten, ort: e.target.value })}
              className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-tanne-900 mb-1">Land</label>
            <input
              value={daten.land || ''}
              onChange={(e) => setDaten({ ...daten, land: e.target.value })}
              className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-tanne-900 mb-1">Telefon</label>
            <input
              value={daten.telefon || ''}
              onChange={(e) => setDaten({ ...daten, telefon: e.target.value })}
              className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-tanne-900 mb-1">E-Mail</label>
            <input
              type="email"
              value={daten.email || ''}
              onChange={(e) => setDaten({ ...daten, email: e.target.value })}
              className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="border-t border-tanne-900/10 pt-4">
          <p className="text-xs font-medium text-tanne-900/60 uppercase tracking-wide mb-3">
            Für Rechnungen &amp; XRechnung
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-tanne-900 mb-1">USt-IdNr.</label>
              <input
                value={daten.ust_idnr || ''}
                onChange={(e) => setDaten({ ...daten, ust_idnr: e.target.value })}
                placeholder="DE123456789"
                className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-tanne-900 mb-1">Steuernummer</label>
              <input
                value={daten.steuernummer || ''}
                onChange={(e) => setDaten({ ...daten, steuernummer: e.target.value })}
                className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-xs font-medium text-tanne-900 mb-1">IBAN</label>
              <input
                value={daten.iban || ''}
                onChange={(e) => setDaten({ ...daten, iban: e.target.value })}
                className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-tanne-900 mb-1">BIC</label>
              <input
                value={daten.bic || ''}
                onChange={(e) => setDaten({ ...daten, bic: e.target.value })}
                className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        {fehler && <p className="text-sm text-rost">{fehler}</p>}
        {hinweis && <p className="text-sm text-moos">{hinweis}</p>}

        <button
          type="submit"
          disabled={speichertGerade}
          className="rounded-lg bg-tanne-800 text-papier text-sm font-medium px-4 py-2 hover:bg-tanne-700 disabled:opacity-60"
        >
          Speichern
        </button>
      </form>
    </div>
  );
}
