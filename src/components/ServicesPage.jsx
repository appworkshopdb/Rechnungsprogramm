import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { KATEGORIEN, OHNE_KATEGORIE } from '../lib/kategorien';

const EINHEITEN = [
  { value: 'stunde', label: 'Stunde' },
  { value: 'tag', label: 'Tag' },
  { value: 'festmeter', label: 'Festmeter' },
  { value: 'pauschale', label: 'Pauschale' },
  { value: 'km', label: 'Kilometer' },
  { value: 'stueck', label: 'Stück' },
  { value: 'frei', label: 'Frei (individuell)' },
];

const LEER_FORMULAR = {
  id: null,
  kategorie: '',
  bezeichnung: '',
  beschreibung: '',
  einheit_fix: true,
  einheit: 'stunde',
  standardpreis: '',
  aktiv: true,
};

export default function ServicesPage() {
  const [leistungen, setLeistungen] = useState([]);
  const [ladeVorgang, setLadeVorgang] = useState(true);
  const [formularOffen, setFormularOffen] = useState(false);
  const [formular, setFormular] = useState(LEER_FORMULAR);
  const [fehler, setFehler] = useState(null);
  const [suche, setSuche] = useState('');

  async function laden() {
    setLadeVorgang(true);
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('bezeichnung', { ascending: true });
    if (!error) setLeistungen(data);
    setLadeVorgang(false);
  }

  useEffect(() => {
    laden();
  }, []);

  function neu() {
    setFormular(LEER_FORMULAR);
    setFormularOffen(true);
    setFehler(null);
  }

  function bearbeiten(eintrag) {
    setFormular({
      ...eintrag,
      kategorie: eintrag.kategorie || '',
      // Ältere Leistungen (vor Einführung des Toggles) haben immer eine
      // Einheit gesetzt -> als "fest" behandeln.
      einheit_fix: eintrag.einheit_fix ?? eintrag.einheit != null,
      einheit: eintrag.einheit || 'stunde',
    });
    setFormularOffen(true);
    setFehler(null);
  }

  async function speichern(e) {
    e.preventDefault();
    setFehler(null);

    if (formular.einheit_fix && !formular.einheit) {
      setFehler('Bitte eine Einheit auswählen oder den Toggle „Einheit festlegen" ausschalten.');
      return;
    }

    const daten = {
      kategorie: formular.kategorie || null,
      bezeichnung: formular.bezeichnung,
      beschreibung: formular.beschreibung || null,
      einheit_fix: formular.einheit_fix,
      einheit: formular.einheit_fix ? formular.einheit : null,
      standardpreis: formular.standardpreis === '' ? null : Number(formular.standardpreis),
      aktiv: formular.aktiv,
    };

    const anfrage = formular.id
      ? supabase.from('services').update(daten).eq('id', formular.id)
      : supabase.from('services').insert(daten);

    const { error } = await anfrage;
    if (error) {
      setFehler('Speichern fehlgeschlagen: ' + error.message);
      return;
    }
    setFormularOffen(false);
    laden();
  }

  // Leistungen nach Kategorie gruppieren, gefiltert nach Suchbegriff
  const gruppiert = useMemo(() => {
    const gefiltert = leistungen.filter((l) =>
      l.bezeichnung.toLowerCase().includes(suche.toLowerCase())
    );
    const gruppen = {};
    gefiltert.forEach((l) => {
      const kat = l.kategorie || OHNE_KATEGORIE;
      if (!gruppen[kat]) gruppen[kat] = [];
      gruppen[kat].push(l);
    });
    // In der definierten Kategorie-Reihenfolge zurückgeben, Unbekanntes ans Ende
    const reihenfolge = [...KATEGORIEN, OHNE_KATEGORIE];
    return reihenfolge
      .filter((kat) => gruppen[kat] && gruppen[kat].length > 0)
      .map((kat) => ({ kategorie: kat, eintraege: gruppen[kat] }));
  }, [leistungen, suche]);

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-tanne-900">Leistungen</h1>
          <p className="text-sm text-tanne-700/70">
            Eure Leistungsarten, nach Kategorie geordnet
          </p>
        </div>
        <button
          onClick={neu}
          className="rounded-lg bg-tanne-800 text-papier text-sm font-medium px-4 py-2 hover:bg-tanne-700 transition-colors"
        >
          + Neue Leistung
        </button>
      </div>

      <input
        type="text"
        placeholder="Leistung suchen…"
        value={suche}
        onChange={(e) => setSuche(e.target.value)}
        className="w-full max-w-xs mb-6 rounded-lg border border-tanne-900/15 bg-white/70 px-3 py-2 text-sm"
      />

      {ladeVorgang ? (
        <p className="text-sm text-tanne-700/60">Lade Leistungen…</p>
      ) : gruppiert.length === 0 ? (
        <div className="rounded-xl border border-dashed border-tanne-900/20 p-8 text-center text-tanne-700/60">
          {suche
            ? 'Keine Leistung gefunden.'
            : 'Noch keine Leistungen angelegt. Leg mit „+ Neue Leistung" die erste an.'}
        </div>
      ) : (
        <div className="space-y-6">
          {gruppiert.map((gruppe) => (
            <div key={gruppe.kategorie}>
              <h2 className="text-xs font-semibold text-tanne-700 uppercase tracking-wide mb-2">
                {gruppe.kategorie}
              </h2>
              <div className="rounded-xl border border-tanne-900/10 bg-white/60 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-tanne-900/5 text-tanne-900/70 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium">Bezeichnung</th>
                      <th className="text-left px-4 py-2.5 font-medium">Einheit</th>
                      <th className="text-left px-4 py-2.5 font-medium">Preis</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {gruppe.eintraege.map((l) => (
                      <tr key={l.id} className="border-t border-tanne-900/5 hover:bg-tanne-900/[0.03]">
                        <td className="px-4 py-2.5 font-medium text-tanne-900">
                          {l.bezeichnung}
                          {!l.aktiv && (
                            <span className="ml-2 text-[11px] text-tanne-700/50">(inaktiv)</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-tanne-900/80">
                          {l.einheit_fix
                            ? EINHEITEN.find((e) => e.value === l.einheit)?.label || l.einheit
                            : (
                              <span className="text-tanne-700/50 italic">manuell in Rechnung</span>
                            )}
                        </td>
                        <td className="px-4 py-2.5 text-tanne-900/80">
                          {l.standardpreis != null ? `${l.standardpreis.toFixed(2)} €` : '–'}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => bearbeiten(l)}
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
            </div>
          ))}
        </div>
      )}

      {formularOffen && (
        <div className="fixed inset-0 bg-tanne-950/40 flex items-center justify-center p-4 z-20">
          <div className="bg-papier rounded-xl shadow-lg w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="font-display text-lg font-semibold text-tanne-900 mb-4">
              {formular.id ? 'Leistung bearbeiten' : 'Neue Leistung'}
            </h2>
            <form onSubmit={speichern} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-tanne-900 mb-1">Kategorie *</label>
                <select
                  required
                  value={formular.kategorie}
                  onChange={(e) => setFormular({ ...formular, kategorie: e.target.value })}
                  className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm bg-white"
                >
                  <option value="">— Kategorie wählen —</option>
                  {KATEGORIEN.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-tanne-900 mb-1">Bezeichnung *</label>
                <input
                  required
                  value={formular.bezeichnung}
                  onChange={(e) => setFormular({ ...formular, bezeichnung: e.target.value })}
                  className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm"
                  placeholder="z.B. Holzernte/Holzeinschlag"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-tanne-900 mb-1">Beschreibung</label>
                <input
                  value={formular.beschreibung || ''}
                  onChange={(e) => setFormular({ ...formular, beschreibung: e.target.value })}
                  className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-tanne-900">Einheit</label>
                  <label className="flex items-center gap-2 text-xs text-tanne-900/80">
                    <input
                      type="checkbox"
                      checked={formular.einheit_fix}
                      onChange={(e) =>
                        setFormular({ ...formular, einheit_fix: e.target.checked })
                      }
                    />
                    Einheit festlegen
                  </label>
                </div>
                {formular.einheit_fix ? (
                  <select
                    required
                    value={formular.einheit}
                    onChange={(e) => setFormular({ ...formular, einheit: e.target.value })}
                    className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm bg-white"
                  >
                    {EINHEITEN.map((e) => (
                      <option key={e.value} value={e.value}>
                        {e.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-tanne-700/60 italic rounded-lg border border-dashed border-tanne-900/15 px-3 py-2">
                    Wird erst in der Rechnung manuell ausgewählt.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium text-tanne-900 mb-1">
                    Standardpreis (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formular.standardpreis}
                    onChange={(e) => setFormular({ ...formular, standardpreis: e.target.value })}
                    className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-tanne-900 pb-2">
                  <input
                    type="checkbox"
                    checked={formular.aktiv}
                    onChange={(e) => setFormular({ ...formular, aktiv: e.target.checked })}
                  />
                  Aktiv
                </label>
              </div>
              <p className="text-[11px] text-tanne-700/50 -mt-1">
                Der Preis wird immer individuell in der Rechnung festgelegt. Der USt.-Satz wird
                ebenfalls erst in der Rechnung ausgewählt.
              </p>

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
