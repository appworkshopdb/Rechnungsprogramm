import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

function neueLeerePosition() {
  return {
    id: `neu-${Math.random().toString(36).slice(2)}`,
    service_id: null,
    bezeichnung: '',
    menge: 1,
    einheit: 'stunde',
    einzelpreis: 0,
  };
}

export default function TemplatesPage() {
  const navigate = useNavigate();
  const [vorlagen, setVorlagen] = useState([]);
  const [kunden, setKunden] = useState([]);
  const [leistungen, setLeistungen] = useState([]);
  const [ladeVorgang, setLadeVorgang] = useState(true);
  const [formularOffen, setFormularOffen] = useState(false);
  const [formular, setFormular] = useState({ id: null, name: '', customer_id: '', standardtext: '' });
  const [positionen, setPositionen] = useState([neueLeerePosition()]);
  const [fehler, setFehler] = useState(null);

  async function laden() {
    setLadeVorgang(true);
    const { data } = await supabase
      .from('invoice_templates')
      .select('*, customers(name), invoice_template_items(*)')
      .order('name');
    setVorlagen(data || []);
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

  function neueVorlage() {
    setFormular({ id: null, name: '', customer_id: '', standardtext: '' });
    setPositionen([neueLeerePosition()]);
    setFormularOffen(true);
    setFehler(null);
  }

  function vorlageBearbeiten(v) {
    setFormular({ id: v.id, name: v.name, customer_id: v.customer_id || '', standardtext: v.standardtext || '' });
    setPositionen(
      v.invoice_template_items.length
        ? v.invoice_template_items
            .sort((a, b) => a.sortierung - b.sortierung)
            .map((it) => ({ ...it }))
        : [neueLeerePosition()]
    );
    setFormularOffen(true);
    setFehler(null);
  }

  function positionAendern(idx, feld, wert) {
    setPositionen((liste) => liste.map((p, i) => (i === idx ? { ...p, [feld]: wert } : p)));
  }

  function leistungUebernehmen(idx, serviceId) {
    const leistung = leistungen.find((l) => l.id === serviceId);
    setPositionen((liste) =>
      liste.map((p, i) =>
        i === idx
          ? {
              ...p,
              service_id: serviceId || null,
              bezeichnung: leistung ? leistung.bezeichnung : p.bezeichnung,
              // In Vorlagen gibt es kein manuelles Einheit-Feld; bei Leistungen ohne
              // feste Einheit bleibt die bisherige Einheit der Position bestehen.
              einheit: leistung?.einheit_fix ? leistung.einheit : p.einheit,
              einzelpreis: leistung?.standardpreis ?? p.einzelpreis,
            }
          : p
      )
    );
  }

  async function speichern(e) {
    e.preventDefault();
    setFehler(null);

    const daten = {
      name: formular.name,
      customer_id: formular.customer_id || null,
      standardtext: formular.standardtext || null,
    };

    let templateId = formular.id;
    if (templateId) {
      const { error } = await supabase.from('invoice_templates').update(daten).eq('id', templateId);
      if (error) return setFehler('Speichern fehlgeschlagen: ' + error.message);
      await supabase.from('invoice_template_items').delete().eq('template_id', templateId);
    } else {
      const { data, error } = await supabase.from('invoice_templates').insert(daten).select().single();
      if (error) return setFehler('Speichern fehlgeschlagen: ' + error.message);
      templateId = data.id;
    }

    const items = positionen
      .filter((p) => p.bezeichnung.trim() !== '')
      .map((p, idx) => ({
        template_id: templateId,
        service_id: p.service_id,
        bezeichnung: p.bezeichnung,
        menge: Number(p.menge || 0),
        einheit: p.einheit,
        einzelpreis: Number(p.einzelpreis || 0),
        sortierung: idx,
      }));
    if (items.length > 0) {
      const { error } = await supabase.from('invoice_template_items').insert(items);
      if (error) return setFehler('Positionen konnten nicht gespeichert werden: ' + error.message);
    }

    setFormularOffen(false);
    laden();
  }

  function rechnungAusVorlageErstellen(v) {
    navigate('/rechnungen/neu', {
      state: {
        vorlage: {
          customer_id: v.customer_id,
          items: v.invoice_template_items,
        },
      },
    });
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-tanne-900">Rechnungsvorlagen</h1>
          <p className="text-sm text-tanne-700/70">
            Wiederkehrende Positionen pro Kunde oder Leistungstyp
          </p>
        </div>
        <button
          onClick={neueVorlage}
          className="rounded-lg bg-tanne-800 text-papier text-sm font-medium px-4 py-2 hover:bg-tanne-700 transition-colors"
        >
          + Neue Vorlage
        </button>
      </div>

      {ladeVorgang ? (
        <p className="text-sm text-tanne-700/60">Lade Vorlagen…</p>
      ) : vorlagen.length === 0 ? (
        <div className="rounded-xl border border-dashed border-tanne-900/20 p-8 text-center text-tanne-700/60">
          Noch keine Vorlagen angelegt, z.B. „Standard Holzernte Gemeinde Musterhausen".
        </div>
      ) : (
        <div className="grid gap-3">
          {vorlagen.map((v) => (
            <div
              key={v.id}
              className="rounded-xl border border-tanne-900/10 bg-white/60 p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-medium text-tanne-900">{v.name}</p>
                <p className="text-xs text-tanne-700/60">
                  {v.customers?.name ? `Kunde: ${v.customers.name} · ` : ''}
                  {v.invoice_template_items.length} Position(en)
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => rechnungAusVorlageErstellen(v)}
                  className="text-xs font-medium rounded-lg bg-tanne-800 text-papier px-3 py-1.5 hover:bg-tanne-700"
                >
                  Rechnung erstellen
                </button>
                <button
                  onClick={() => vorlageBearbeiten(v)}
                  className="text-xs font-medium text-tanne-700 hover:underline"
                >
                  Bearbeiten
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {formularOffen && (
        <div className="fixed inset-0 bg-tanne-950/40 flex items-center justify-center p-4 z-20">
          <div className="bg-papier rounded-xl shadow-lg w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="font-display text-lg font-semibold text-tanne-900 mb-4">
              {formular.id ? 'Vorlage bearbeiten' : 'Neue Vorlage'}
            </h2>
            <form onSubmit={speichern} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-tanne-900 mb-1">Name *</label>
                  <input
                    required
                    value={formular.name}
                    onChange={(e) => setFormular({ ...formular, name: e.target.value })}
                    className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm"
                    placeholder="z.B. Standard Holzernte"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-tanne-900 mb-1">
                    Kunde (optional)
                  </label>
                  <select
                    value={formular.customer_id}
                    onChange={(e) => setFormular({ ...formular, customer_id: e.target.value })}
                    className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm bg-white"
                  >
                    <option value="">— frei verwendbar —</option>
                    {kunden.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-tanne-900 mb-2">Standardpositionen</p>
                <div className="space-y-2">
                  {positionen.map((p, idx) => (
                    <div key={p.id} className="grid grid-cols-12 gap-2 items-center">
                      <select
                        value={p.service_id || ''}
                        onChange={(e) => leistungUebernehmen(idx, e.target.value || null)}
                        className="col-span-4 text-xs rounded-lg border border-tanne-900/15 px-2 py-1.5"
                      >
                        <option value="">— Leistung wählen —</option>
                        {leistungen.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.bezeichnung}
                          </option>
                        ))}
                      </select>
                      <input
                        value={p.bezeichnung}
                        onChange={(e) => positionAendern(idx, 'bezeichnung', e.target.value)}
                        placeholder="Bezeichnung"
                        className="col-span-4 text-xs rounded-lg border border-tanne-900/15 px-2 py-1.5"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={p.menge}
                        onChange={(e) => positionAendern(idx, 'menge', e.target.value)}
                        placeholder="Menge"
                        className="col-span-2 text-xs rounded-lg border border-tanne-900/15 px-2 py-1.5"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={p.einzelpreis}
                        onChange={(e) => positionAendern(idx, 'einzelpreis', e.target.value)}
                        placeholder="Preis €"
                        className="col-span-1 text-xs rounded-lg border border-tanne-900/15 px-2 py-1.5"
                      />
                      <button
                        type="button"
                        onClick={() => setPositionen((liste) => liste.filter((_, i) => i !== idx))}
                        className="col-span-1 text-rost text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setPositionen((liste) => [...liste, neueLeerePosition()])}
                  className="text-xs font-medium text-tanne-700 hover:underline mt-2"
                >
                  + Position hinzufügen
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-tanne-900 mb-1">
                  Standardtext (optional)
                </label>
                <textarea
                  value={formular.standardtext}
                  onChange={(e) => setFormular({ ...formular, standardtext: e.target.value })}
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
