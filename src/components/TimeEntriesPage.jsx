import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';

const LEER_FORMULAR = {
  customer_id: '',
  service_id: '',
  datum: '',
  stunden: '',
  beschreibung: '',
};

export default function TimeEntriesPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [eintraege, setEintraege] = useState([]);
  const [kunden, setKunden] = useState([]);
  const [leistungen, setLeistungen] = useState([]);
  const [ladeVorgang, setLadeVorgang] = useState(true);
  const [formularOffen, setFormularOffen] = useState(false);
  const [formular, setFormular] = useState(LEER_FORMULAR);
  const [ausgewaehlt, setAusgewaehlt] = useState([]);
  const [fehler, setFehler] = useState(null);

  async function laden() {
    setLadeVorgang(true);
    const { data } = await supabase
      .from('time_entries')
      .select('*, customers(name), services(bezeichnung, standardpreis, einheit), profiles(full_name)')
      .order('datum', { ascending: false });
    setEintraege(data || []);
    setLadeVorgang(false);
  }

  useEffect(() => {
    laden();
    supabase.from('customers').select('id, name').order('name').then(({ data }) => setKunden(data || []));
    supabase
      .from('services')
      .select('*')
      .eq('aktiv', true)
      .order('bezeichnung')
      .then(({ data }) => setLeistungen(data || []));
  }, []);

  function neu() {
    setFormular({ ...LEER_FORMULAR, datum: new Date().toISOString().slice(0, 10) });
    setFormularOffen(true);
    setFehler(null);
  }

  async function speichern(e) {
    e.preventDefault();
    setFehler(null);
    const { error } = await supabase.from('time_entries').insert({
      customer_id: formular.customer_id || null,
      service_id: formular.service_id || null,
      mitarbeiter_id: profile?.id,
      datum: formular.datum,
      stunden: Number(formular.stunden),
      beschreibung: formular.beschreibung || null,
    });
    if (error) {
      setFehler('Speichern fehlgeschlagen: ' + error.message);
      return;
    }
    setFormularOffen(false);
    laden();
  }

  function auswahlUmschalten(id) {
    setAusgewaehlt((liste) => (liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id]));
  }

  const offeneEintraege = eintraege.filter((e) => !e.abgerechnet);
  const ausgewaehlteEintraege = offeneEintraege.filter((e) => ausgewaehlt.includes(e.id));

  // Alle ausgewählten Einträge müssen zum selben Kunden gehören, sonst
  // ergibt "in eine Rechnung übernehmen" keinen Sinn.
  const kundenInAuswahl = new Set(ausgewaehlteEintraege.map((e) => e.customer_id));
  const auswahlGueltig = ausgewaehlteEintraege.length > 0 && kundenInAuswahl.size === 1;

  function inRechnungUebernehmen() {
    navigate('/rechnungen/neu', {
      state: {
        vorlage: {
          customer_id: ausgewaehlteEintraege[0].customer_id,
          items: ausgewaehlteEintraege.map((e) => ({
            service_id: e.service_id,
            bezeichnung: e.services?.bezeichnung || e.beschreibung || 'Arbeitszeit',
            menge: e.stunden,
            einheit: 'stunde',
            einzelpreis: e.services?.standardpreis ?? 0,
          })),
        },
      },
    });
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-tanne-900">Zeiterfassung</h1>
          <p className="text-sm text-tanne-700/70">Stunden erfassen und in Rechnungen übernehmen</p>
        </div>
        <button
          onClick={neu}
          className="rounded-lg bg-tanne-800 text-papier text-sm font-medium px-4 py-2 hover:bg-tanne-700 transition-colors"
        >
          + Zeit erfassen
        </button>
      </div>

      {ausgewaehlt.length > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-tanne-800/5 border border-tanne-800/15 px-4 py-2.5">
          <p className="text-sm text-tanne-900">
            {ausgewaehlt.length} Eintrag/Einträge ausgewählt
            {!auswahlGueltig && ausgewaehlteEintraege.length > 0 && (
              <span className="text-rost"> – bitte nur Einträge desselben Kunden wählen</span>
            )}
          </p>
          <button
            onClick={inRechnungUebernehmen}
            disabled={!auswahlGueltig}
            className="text-xs font-medium rounded-lg bg-tanne-800 text-papier px-3 py-1.5 hover:bg-tanne-700 disabled:opacity-40"
          >
            In Rechnung übernehmen
          </button>
        </div>
      )}

      {ladeVorgang ? (
        <p className="text-sm text-tanne-700/60">Lade…</p>
      ) : eintraege.length === 0 ? (
        <div className="rounded-xl border border-dashed border-tanne-900/20 p-8 text-center text-tanne-700/60">
          Noch keine Zeiten erfasst.
        </div>
      ) : (
        <div className="rounded-xl border border-tanne-900/10 bg-white/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-tanne-900/5 text-tanne-900/70 text-xs uppercase tracking-wide">
              <tr>
                <th className="w-8"></th>
                <th className="text-left px-4 py-3 font-medium">Datum</th>
                <th className="text-left px-4 py-3 font-medium">Kunde</th>
                <th className="text-left px-4 py-3 font-medium">Leistung</th>
                <th className="text-right px-4 py-3 font-medium">Stunden</th>
                <th className="text-left px-4 py-3 font-medium">Mitarbeiter</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {eintraege.map((e) => (
                <tr key={e.id} className="border-t border-tanne-900/5 hover:bg-tanne-900/[0.03]">
                  <td className="px-4 py-2">
                    {!e.abgerechnet && (
                      <input
                        type="checkbox"
                        checked={ausgewaehlt.includes(e.id)}
                        onChange={() => auswahlUmschalten(e.id)}
                      />
                    )}
                  </td>
                  <td className="px-4 py-2 text-tanne-900/80">
                    {new Date(e.datum).toLocaleDateString('de-DE')}
                  </td>
                  <td className="px-4 py-2 text-tanne-900/90">{e.customers?.name || '–'}</td>
                  <td className="px-4 py-2 text-tanne-900/80">
                    {e.services?.bezeichnung || e.beschreibung || '–'}
                  </td>
                  <td className="px-4 py-2 text-right text-tanne-900">{Number(e.stunden).toFixed(2)}</td>
                  <td className="px-4 py-2 text-tanne-900/70">{e.profiles?.full_name || '–'}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        e.abgerechnet
                          ? 'bg-moos/25 text-tanne-800'
                          : 'bg-tanne-900/10 text-tanne-900/70'
                      }`}
                    >
                      {e.abgerechnet ? 'Abgerechnet' : 'Offen'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formularOffen && (
        <div className="fixed inset-0 bg-tanne-950/40 flex items-center justify-center p-4 z-20">
          <div className="bg-papier rounded-xl shadow-lg w-full max-w-md p-6">
            <h2 className="font-display text-lg font-semibold text-tanne-900 mb-4">Zeit erfassen</h2>
            <form onSubmit={speichern} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-tanne-900 mb-1">Kunde</label>
                <select
                  value={formular.customer_id}
                  onChange={(e) => setFormular({ ...formular, customer_id: e.target.value })}
                  className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm bg-white"
                >
                  <option value="">— auswählen —</option>
                  {kunden.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-tanne-900 mb-1">Leistung</label>
                <select
                  value={formular.service_id}
                  onChange={(e) => setFormular({ ...formular, service_id: e.target.value })}
                  className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm bg-white"
                >
                  <option value="">— optional —</option>
                  {leistungen.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.bezeichnung}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-tanne-900 mb-1">Datum</label>
                  <input
                    type="date"
                    required
                    value={formular.datum}
                    onChange={(e) => setFormular({ ...formular, datum: e.target.value })}
                    className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-tanne-900 mb-1">Stunden</label>
                  <input
                    type="number"
                    step="0.25"
                    required
                    value={formular.stunden}
                    onChange={(e) => setFormular({ ...formular, stunden: e.target.value })}
                    className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-tanne-900 mb-1">Beschreibung</label>
                <textarea
                  value={formular.beschreibung}
                  onChange={(e) => setFormular({ ...formular, beschreibung: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm"
                />
              </div>

              {fehler && <p className="text-sm text-rost">{fehler}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFormularOffen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-tanne-900/70 hover:bg-tanne-900/5"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-tanne-800 text-papier text-sm font-medium px-4 py-2 hover:bg-tanne-700"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
