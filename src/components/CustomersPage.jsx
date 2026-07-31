import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const LEER_FORMULAR = {
  id: null,
  name: '',
  kundentyp: 'privat',
  leitweg_id: '',
  strasse: '',
  plz: '',
  ort: '',
  email: '',
  telefon: '',
  notiz: '',
};

export default function CustomersPage() {
  const [kunden, setKunden] = useState([]);
  const [ladeVorgang, setLadeVorgang] = useState(true);
  const [formularOffen, setFormularOffen] = useState(false);
  const [formular, setFormular] = useState(LEER_FORMULAR);
  const [suche, setSuche] = useState('');
  const [fehler, setFehler] = useState(null);

  async function kundenLaden() {
    setLadeVorgang(true);
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name', { ascending: true });
    if (!error) setKunden(data);
    setLadeVorgang(false);
  }

  useEffect(() => {
    kundenLaden();
  }, []);

  function neuerKunde() {
    setFormular(LEER_FORMULAR);
    setFormularOffen(true);
    setFehler(null);
  }

  function kundeBearbeiten(kunde) {
    setFormular(kunde);
    setFormularOffen(true);
    setFehler(null);
  }

  async function speichern(e) {
    e.preventDefault();
    setFehler(null);

    const daten = {
      name: formular.name,
      kundentyp: formular.kundentyp,
      leitweg_id: formular.leitweg_id || null,
      strasse: formular.strasse || null,
      plz: formular.plz || null,
      ort: formular.ort || null,
      email: formular.email || null,
      telefon: formular.telefon || null,
      notiz: formular.notiz || null,
    };

    const anfrage = formular.id
      ? supabase.from('customers').update(daten).eq('id', formular.id)
      : supabase.from('customers').insert(daten);

    const { error } = await anfrage;
    if (error) {
      setFehler('Speichern fehlgeschlagen: ' + error.message);
      return;
    }
    setFormularOffen(false);
    kundenLaden();
  }

  const gefilterteKunden = kunden.filter((k) =>
    k.name.toLowerCase().includes(suche.toLowerCase())
  );

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-tanne-900">Kunden</h1>
          <p className="text-sm text-tanne-700/70">Forstämter, Gemeinden und private Waldbesitzer</p>
        </div>
        <button
          onClick={neuerKunde}
          className="rounded-lg bg-tanne-800 text-papier text-sm font-medium px-4 py-2 hover:bg-tanne-700 transition-colors"
        >
          + Neuer Kunde
        </button>
      </div>

      <input
        type="text"
        placeholder="Kunde suchen…"
        value={suche}
        onChange={(e) => setSuche(e.target.value)}
        className="w-full max-w-xs mb-4 rounded-lg border border-tanne-900/15 bg-white/70 px-3 py-2 text-sm"
      />

      {ladeVorgang ? (
        <p className="text-sm text-tanne-700/60">Lade Kunden…</p>
      ) : gefilterteKunden.length === 0 ? (
        <div className="rounded-xl border border-dashed border-tanne-900/20 p-8 text-center text-tanne-700/60">
          Noch keine Kunden angelegt. Leg mit „+ Neuer Kunde" den ersten an.
        </div>
      ) : (
        <div className="rounded-xl border border-tanne-900/10 bg-white/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-tanne-900/5 text-tanne-900/70 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Typ</th>
                <th className="text-left px-4 py-3 font-medium">Ort</th>
                <th className="text-left px-4 py-3 font-medium">Kontakt</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {gefilterteKunden.map((k) => (
                <tr key={k.id} className="border-t border-tanne-900/5 hover:bg-tanne-900/[0.03]">
                  <td className="px-4 py-3 font-medium text-tanne-900">{k.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        k.kundentyp === 'oeffentlich'
                          ? 'bg-moos/20 text-tanne-800'
                          : 'bg-rinde-300/30 text-rinde-700'
                      }`}
                    >
                      {k.kundentyp === 'oeffentlich' ? 'Öffentlich' : 'Privat'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-tanne-900/80">{k.ort || '–'}</td>
                  <td className="px-4 py-3 text-tanne-900/80">{k.email || k.telefon || '–'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => kundeBearbeiten(k)}
                      className="text-tanne-700 hover:underline text-xs font-medium"
                    >
                      Bearbeiten
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formularOffen && (
        <div className="fixed inset-0 bg-tanne-950/40 flex items-center justify-center p-4 z-20">
          <div className="bg-papier rounded-xl shadow-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="font-display text-lg font-semibold text-tanne-900 mb-4">
              {formular.id ? 'Kunde bearbeiten' : 'Neuer Kunde'}
            </h2>
            <form onSubmit={speichern} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-tanne-900 mb-1">Name *</label>
                <input
                  required
                  value={formular.name}
                  onChange={(e) => setFormular({ ...formular, name: e.target.value })}
                  className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-tanne-900 mb-1">Kundentyp</label>
                <select
                  value={formular.kundentyp}
                  onChange={(e) => setFormular({ ...formular, kundentyp: e.target.value })}
                  className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm bg-white"
                >
                  <option value="privat">Privat</option>
                  <option value="oeffentlich">Öffentlich (Forstamt/Gemeinde)</option>
                </select>
              </div>

              {formular.kundentyp === 'oeffentlich' && (
                <div>
                  <label className="block text-xs font-medium text-tanne-900 mb-1">
                    Leitweg-ID (falls bekannt)
                  </label>
                  <input
                    value={formular.leitweg_id || ''}
                    onChange={(e) => setFormular({ ...formular, leitweg_id: e.target.value })}
                    className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm"
                    placeholder="z.B. 04011000-1234512345-06"
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-tanne-900 mb-1">Straße</label>
                  <input
                    value={formular.strasse || ''}
                    onChange={(e) => setFormular({ ...formular, strasse: e.target.value })}
                    className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-tanne-900 mb-1">PLZ</label>
                  <input
                    value={formular.plz || ''}
                    onChange={(e) => setFormular({ ...formular, plz: e.target.value })}
                    className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-tanne-900 mb-1">Ort</label>
                <input
                  value={formular.ort || ''}
                  onChange={(e) => setFormular({ ...formular, ort: e.target.value })}
                  className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-tanne-900 mb-1">E-Mail</label>
                  <input
                    type="email"
                    value={formular.email || ''}
                    onChange={(e) => setFormular({ ...formular, email: e.target.value })}
                    className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-tanne-900 mb-1">Telefon</label>
                  <input
                    value={formular.telefon || ''}
                    onChange={(e) => setFormular({ ...formular, telefon: e.target.value })}
                    className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-tanne-900 mb-1">Notiz</label>
                <textarea
                  value={formular.notiz || ''}
                  onChange={(e) => setFormular({ ...formular, notiz: e.target.value })}
                  className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm"
                  rows={2}
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
