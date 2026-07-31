import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';

const LEER_FORMULAR = { id: null, bezeichnung: '', kategorie: '', betrag: '', datum: '', notiz: '' };

export default function ExpensesPage() {
  const { istAdminOderBuchhaltung, profile } = useAuth();
  const [ausgaben, setAusgaben] = useState([]);
  const [ladeVorgang, setLadeVorgang] = useState(true);
  const [formularOffen, setFormularOffen] = useState(false);
  const [formular, setFormular] = useState(LEER_FORMULAR);
  const [fehler, setFehler] = useState(null);

  async function laden() {
    setLadeVorgang(true);
    const { data } = await supabase.from('expenses').select('*').order('datum', { ascending: false });
    setAusgaben(data || []);
    setLadeVorgang(false);
  }

  useEffect(() => {
    laden();
  }, []);

  function neu() {
    setFormular({ ...LEER_FORMULAR, datum: new Date().toISOString().slice(0, 10) });
    setFormularOffen(true);
    setFehler(null);
  }

  function bearbeiten(a) {
    setFormular(a);
    setFormularOffen(true);
    setFehler(null);
  }

  async function speichern(e) {
    e.preventDefault();
    setFehler(null);

    const daten = {
      bezeichnung: formular.bezeichnung,
      kategorie: formular.kategorie || null,
      betrag: Number(formular.betrag || 0),
      datum: formular.datum || new Date().toISOString().slice(0, 10),
      notiz: formular.notiz || null,
    };

    const anfrage = formular.id
      ? supabase.from('expenses').update(daten).eq('id', formular.id)
      : supabase.from('expenses').insert({ ...daten, created_by: profile?.id });

    const { error } = await anfrage;
    if (error) {
      setFehler('Speichern fehlgeschlagen: ' + error.message);
      return;
    }
    setFormularOffen(false);
    laden();
  }

  async function loeschen(id) {
    if (!confirm('Diese Ausgabe wirklich löschen?')) return;
    await supabase.from('expenses').delete().eq('id', id);
    laden();
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-tanne-900">Ausgaben</h1>
          <p className="text-sm text-tanne-700/70">Betriebsausgaben für die Einnahmen-Ausgaben-Übersicht</p>
        </div>
        <button
          onClick={neu}
          className="rounded-lg bg-tanne-800 text-papier text-sm font-medium px-4 py-2 hover:bg-tanne-700 transition-colors"
        >
          + Neue Ausgabe
        </button>
      </div>

      {ladeVorgang ? (
        <p className="text-sm text-tanne-700/60">Lade…</p>
      ) : ausgaben.length === 0 ? (
        <div className="rounded-xl border border-dashed border-tanne-900/20 p-8 text-center text-tanne-700/60">
          Noch keine Ausgaben erfasst.
        </div>
      ) : (
        <div className="rounded-xl border border-tanne-900/10 bg-white/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-tanne-900/5 text-tanne-900/70 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Datum</th>
                <th className="text-left px-4 py-3 font-medium">Bezeichnung</th>
                <th className="text-left px-4 py-3 font-medium">Kategorie</th>
                <th className="text-right px-4 py-3 font-medium">Betrag</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ausgaben.map((a) => (
                <tr key={a.id} className="border-t border-tanne-900/5 hover:bg-tanne-900/[0.03]">
                  <td className="px-4 py-3 text-tanne-900/80">
                    {new Date(a.datum).toLocaleDateString('de-DE')}
                  </td>
                  <td className="px-4 py-3 font-medium text-tanne-900">{a.bezeichnung}</td>
                  <td className="px-4 py-3 text-tanne-900/70">{a.kategorie || '–'}</td>
                  <td className="px-4 py-3 text-right text-tanne-900">{Number(a.betrag).toFixed(2)} €</td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button
                      onClick={() => bearbeiten(a)}
                      className="text-tanne-700 hover:underline text-xs font-medium"
                    >
                      Bearbeiten
                    </button>
                    {istAdminOderBuchhaltung && (
                      <button
                        onClick={() => loeschen(a.id)}
                        className="text-rost hover:underline text-xs font-medium"
                      >
                        Löschen
                      </button>
                    )}
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
            <h2 className="font-display text-lg font-semibold text-tanne-900 mb-4">
              {formular.id ? 'Ausgabe bearbeiten' : 'Neue Ausgabe'}
            </h2>
            <form onSubmit={speichern} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-tanne-900 mb-1">Bezeichnung *</label>
                <input
                  required
                  value={formular.bezeichnung}
                  onChange={(e) => setFormular({ ...formular, bezeichnung: e.target.value })}
                  className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm"
                  placeholder="z.B. Kraftstoff, Maschinenwartung"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-tanne-900 mb-1">Kategorie</label>
                  <input
                    value={formular.kategorie || ''}
                    onChange={(e) => setFormular({ ...formular, kategorie: e.target.value })}
                    className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-tanne-900 mb-1">Betrag (€) *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={formular.betrag}
                    onChange={(e) => setFormular({ ...formular, betrag: e.target.value })}
                    className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-tanne-900 mb-1">Datum</label>
                <input
                  type="date"
                  value={formular.datum}
                  onChange={(e) => setFormular({ ...formular, datum: e.target.value })}
                  className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-tanne-900 mb-1">Notiz</label>
                <textarea
                  value={formular.notiz || ''}
                  onChange={(e) => setFormular({ ...formular, notiz: e.target.value })}
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
