import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';

const EINHEIT_LABEL = {
  stunde: 'Std.',
  tag: 'Tag(e)',
  festmeter: 'Fm',
  pauschale: 'Pausch.',
  km: 'km',
  stueck: 'Stk.',
  frei: '',
};

function neueLeerePosition() {
  return {
    id: `neu-${Math.random().toString(36).slice(2)}`,
    service_id: null,
    bezeichnung: '',
    menge: 1,
    einheit: 'stunde',
    einzelpreis: 0,
    ust_satz: 19,
  };
}

export default function CreditNoteEditor() {
  const { id } = useParams();
  const istNeu = id === 'neu';
  const navigate = useNavigate();
  const { istAdminOderBuchhaltung, profile } = useAuth();

  const [kunden, setKunden] = useState([]);
  const [leistungen, setLeistungen] = useState([]);
  const [rechnungenListe, setRechnungenListe] = useState([]);
  const [gutschrift, setGutschrift] = useState({
    id: null,
    customer_id: '',
    invoice_id: '',
    status: 'entwurf',
    gutschriftdatum: '',
    grund: '',
    notiz: '',
    nummer: null,
  });
  const [positionen, setPositionen] = useState([neueLeerePosition()]);
  const [ladeVorgang, setLadeVorgang] = useState(true);
  const [speichertGerade, setSpeichertGerade] = useState(false);
  const [fehler, setFehler] = useState(null);

  const gesperrt = gutschrift.status !== 'entwurf';

  useEffect(() => {
    supabase.from('customers').select('id, name').order('name').then(({ data }) => setKunden(data || []));
    supabase
      .from('services')
      .select('*')
      .eq('aktiv', true)
      .order('bezeichnung')
      .then(({ data }) => setLeistungen(data || []));
    supabase
      .from('invoices')
      .select('id, nummer, customer_id')
      .not('nummer', 'is', null)
      .order('nummer', { ascending: false })
      .then(({ data }) => setRechnungenListe(data || []));
  }, []);

  useEffect(() => {
    async function laden() {
      setLadeVorgang(true);
      if (istNeu) {
        setLadeVorgang(false);
        return;
      }
      const { data: gs } = await supabase.from('credit_notes').select('*').eq('id', id).single();
      const { data: items } = await supabase
        .from('credit_note_items')
        .select('*')
        .eq('credit_note_id', id)
        .order('sortierung');
      setGutschrift(gs);
      setPositionen(items && items.length ? items : [neueLeerePosition()]);
      setLadeVorgang(false);
    }
    laden();
  }, [id]);

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
              einheit: leistung ? leistung.einheit : p.einheit,
              einzelpreis: leistung?.standardpreis ?? p.einzelpreis,
              ust_satz: leistung?.ust_satz ?? p.ust_satz,
            }
          : p
      )
    );
  }

  const summen = useMemo(() => {
    const netto = positionen.reduce((s, p) => s + Number(p.menge || 0) * Number(p.einzelpreis || 0), 0);
    const ustGruppen = {};
    positionen.forEach((p) => {
      const satz = Number(p.ust_satz || 0);
      const zeilenNetto = Number(p.menge || 0) * Number(p.einzelpreis || 0);
      ustGruppen[satz] = (ustGruppen[satz] || 0) + zeilenNetto * (satz / 100);
    });
    const ustGesamt = Object.values(ustGruppen).reduce((a, b) => a + b, 0);
    return { netto, ustGruppen, ustGesamt, brutto: netto + ustGesamt };
  }, [positionen]);

  async function speichern({ alsFreigabe = false } = {}) {
    setFehler(null);
    setSpeichertGerade(true);

    if (!gutschrift.customer_id) {
      setFehler('Bitte einen Kunden auswählen.');
      setSpeichertGerade(false);
      return;
    }

    const daten = {
      customer_id: gutschrift.customer_id,
      invoice_id: gutschrift.invoice_id || null,
      gutschriftdatum: gutschrift.gutschriftdatum || null,
      grund: gutschrift.grund || null,
      notiz: gutschrift.notiz || null,
    };

    let gutschriftId = gutschrift.id;
    if (istNeu && !gutschriftId) {
      const { data, error } = await supabase
        .from('credit_notes')
        .insert({ ...daten, created_by: profile?.id })
        .select()
        .single();
      if (error) {
        setFehler('Speichern fehlgeschlagen: ' + error.message);
        setSpeichertGerade(false);
        return;
      }
      gutschriftId = data.id;
      setGutschrift(data);
    } else {
      const { error } = await supabase.from('credit_notes').update(daten).eq('id', gutschriftId);
      if (error) {
        setFehler('Speichern fehlgeschlagen: ' + error.message);
        setSpeichertGerade(false);
        return;
      }
    }

    await supabase.from('credit_note_items').delete().eq('credit_note_id', gutschriftId);
    const items = positionen
      .filter((p) => p.bezeichnung.trim() !== '')
      .map((p, idx) => ({
        credit_note_id: gutschriftId,
        service_id: p.service_id,
        bezeichnung: p.bezeichnung,
        menge: Number(p.menge || 0),
        einheit: p.einheit,
        einzelpreis: Number(p.einzelpreis || 0),
        ust_satz: Number(p.ust_satz || 0),
        sortierung: idx,
      }));
    if (items.length > 0) {
      const { error } = await supabase.from('credit_note_items').insert(items);
      if (error) {
        setFehler('Positionen konnten nicht gespeichert werden: ' + error.message);
        setSpeichertGerade(false);
        return;
      }
    }

    if (alsFreigabe) {
      const { error } = await supabase.rpc('gutschrift_freigeben', { p_id: gutschriftId });
      if (error) {
        setFehler('Freigabe fehlgeschlagen: ' + error.message);
        setSpeichertGerade(false);
        return;
      }
    }

    setSpeichertGerade(false);
    navigate(`/gutschriften/${gutschriftId}`, { replace: true });
  }

  if (ladeVorgang) return <div className="p-8 text-sm text-tanne-700/60">Lade…</div>;

  const passendeRechnungen = rechnungenListe.filter(
    (r) => !gutschrift.customer_id || r.customer_id === gutschrift.customer_id
  );

  return (
    <div className="p-8 max-w-4xl">
      <div className="no-print flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-tanne-900">
            {istNeu ? 'Neue Gutschrift' : gutschrift.nummer || 'Gutschrift-Entwurf'}
          </h1>
          {gesperrt && (
            <p className="text-xs text-moos font-medium mt-1">🔒 Freigegeben – nicht mehr veränderbar</p>
          )}
        </div>
        <div className="flex gap-2">
          {!gesperrt && (
            <button
              onClick={() => speichern({ alsFreigabe: false })}
              disabled={speichertGerade}
              className="rounded-lg border border-tanne-900/20 text-tanne-900 text-sm font-medium px-4 py-2 hover:bg-tanne-900/5 disabled:opacity-60"
            >
              Entwurf speichern
            </button>
          )}
          {!gesperrt && istAdminOderBuchhaltung && (
            <button
              onClick={() => speichern({ alsFreigabe: true })}
              disabled={speichertGerade}
              className="rounded-lg bg-tanne-800 text-papier text-sm font-medium px-4 py-2 hover:bg-tanne-700 disabled:opacity-60"
            >
              Freigeben
            </button>
          )}
          {gesperrt && (
            <button
              onClick={() => window.print()}
              className="rounded-lg bg-tanne-800 text-papier text-sm font-medium px-4 py-2 hover:bg-tanne-700"
            >
              Drucken / Als PDF speichern
            </button>
          )}
        </div>
      </div>

      {fehler && <p className="no-print text-sm text-rost mb-4">{fehler}</p>}

      <div className="print-area bg-white rounded-xl border border-tanne-900/10 shadow-sm p-8">
        <div className="flex justify-between mb-8">
          <div className="flex items-center gap-4">
            <img src="/logo.svg" alt="Forstservice Elsasser Logo" className="h-16 w-auto shrink-0" />
            <div>
              <p className="font-display text-lg font-semibold text-tanne-900">Forstservice</p>
              <p className="text-xs text-tanne-700/60 mt-1">Gutschrift</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p className="text-tanne-900/60">Gutschrift-Nr.</p>
            <p className="font-mono font-medium text-tanne-900">
              {gutschrift.nummer || '— wird bei Freigabe vergeben —'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-4 no-print">
          <div>
            <label className="block text-xs font-medium text-tanne-900 mb-1">Kunde *</label>
            <select
              disabled={gesperrt}
              value={gutschrift.customer_id || ''}
              onChange={(e) => setGutschrift({ ...gutschrift, customer_id: e.target.value, invoice_id: '' })}
              className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm bg-white disabled:opacity-60"
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
            <label className="block text-xs font-medium text-tanne-900 mb-1">
              Bezug auf Rechnung (optional)
            </label>
            <select
              disabled={gesperrt}
              value={gutschrift.invoice_id || ''}
              onChange={(e) => setGutschrift({ ...gutschrift, invoice_id: e.target.value })}
              className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm bg-white disabled:opacity-60"
            >
              <option value="">— keine —</option>
              {passendeRechnungen.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nummer}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8 no-print">
          <div>
            <label className="block text-xs font-medium text-tanne-900 mb-1">Grund</label>
            <input
              disabled={gesperrt}
              value={gutschrift.grund || ''}
              onChange={(e) => setGutschrift({ ...gutschrift, grund: e.target.value })}
              placeholder="z.B. Mengenkorrektur, Reklamation"
              className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-tanne-900 mb-1">Datum (optional)</label>
            <input
              type="date"
              disabled={gesperrt}
              value={gutschrift.gutschriftdatum || ''}
              onChange={(e) => setGutschrift({ ...gutschrift, gutschriftdatum: e.target.value })}
              className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm disabled:opacity-60"
            />
          </div>
        </div>

        <div className="mb-4 text-sm">
          <p className="text-tanne-900/60">Gutschrift an</p>
          <p className="font-medium text-tanne-900">
            {kunden.find((k) => k.id === gutschrift.customer_id)?.name || '—'}
          </p>
          {gutschrift.grund && <p className="text-tanne-900/70 text-xs mt-1">Grund: {gutschrift.grund}</p>}
        </div>

        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="border-b border-tanne-900/15 text-xs uppercase tracking-wide text-tanne-900/60">
              <th className="text-left py-2">Bezeichnung</th>
              <th className="text-right py-2 w-20">Menge</th>
              <th className="text-left py-2 w-20 no-print">Einheit</th>
              <th className="text-right py-2 w-24">Einzelpr.</th>
              <th className="text-right py-2 w-16 no-print">USt.</th>
              <th className="text-right py-2 w-24">Summe</th>
              <th className="w-8 no-print"></th>
            </tr>
          </thead>
          <tbody>
            {positionen.map((p, idx) => (
              <tr key={p.id} className="border-b border-tanne-900/5">
                <td className="py-2 pr-2">
                  <select
                    disabled={gesperrt}
                    value={p.service_id || ''}
                    onChange={(e) => leistungUebernehmen(idx, e.target.value || null)}
                    className="no-print w-full text-xs text-tanne-700/50 mb-1 border-0 bg-transparent"
                  >
                    <option value="">— Leistung übernehmen —</option>
                    {leistungen.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.bezeichnung}
                      </option>
                    ))}
                  </select>
                  <input
                    disabled={gesperrt}
                    value={p.bezeichnung}
                    onChange={(e) => positionAendern(idx, 'bezeichnung', e.target.value)}
                    placeholder="Bezeichnung"
                    className="w-full border-0 bg-transparent px-0 py-1 text-sm disabled:opacity-90"
                  />
                </td>
                <td className="py-2 text-right">
                  <input
                    disabled={gesperrt}
                    type="number"
                    step="0.01"
                    value={p.menge}
                    onChange={(e) => positionAendern(idx, 'menge', e.target.value)}
                    className="w-16 text-right border-0 bg-transparent px-0 py-1 text-sm disabled:opacity-90"
                  />
                </td>
                <td className="py-2 no-print">
                  <select
                    disabled={gesperrt}
                    value={p.einheit}
                    onChange={(e) => positionAendern(idx, 'einheit', e.target.value)}
                    className="w-full text-xs border-0 bg-transparent py-1"
                  >
                    {Object.entries(EINHEIT_LABEL).map(([wert, label]) => (
                      <option key={wert} value={wert}>
                        {label || wert}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 text-right">
                  <input
                    disabled={gesperrt}
                    type="number"
                    step="0.01"
                    value={p.einzelpreis}
                    onChange={(e) => positionAendern(idx, 'einzelpreis', e.target.value)}
                    className="w-20 text-right border-0 bg-transparent px-0 py-1 text-sm disabled:opacity-90"
                  />
                  <span className="text-xs text-tanne-700/50"> €</span>
                </td>
                <td className="py-2 text-right no-print">
                  <input
                    disabled={gesperrt}
                    type="number"
                    step="0.01"
                    value={p.ust_satz}
                    onChange={(e) => positionAendern(idx, 'ust_satz', e.target.value)}
                    className="w-14 text-right border-0 bg-transparent px-0 py-1 text-sm disabled:opacity-90"
                  />
                </td>
                <td className="py-2 text-right font-medium text-tanne-900">
                  {(Number(p.menge || 0) * Number(p.einzelpreis || 0)).toFixed(2)} €
                </td>
                <td className="py-2 text-right no-print">
                  {!gesperrt && (
                    <button
                      onClick={() => setPositionen((liste) => liste.filter((_, i) => i !== idx))}
                      className="text-rost text-xs"
                    >
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!gesperrt && (
          <button
            onClick={() => setPositionen((liste) => [...liste, neueLeerePosition()])}
            className="no-print text-xs font-medium text-tanne-700 hover:underline mb-6"
          >
            + Position hinzufügen
          </button>
        )}

        <div className="flex justify-end">
          <div className="w-64 text-sm space-y-1">
            <div className="flex justify-between text-tanne-900/70">
              <span>Netto</span>
              <span>{summen.netto.toFixed(2)} €</span>
            </div>
            {Object.entries(summen.ustGruppen).map(([satz, betrag]) => (
              <div key={satz} className="flex justify-between text-tanne-900/70">
                <span>zzgl. {satz}% USt.</span>
                <span>{betrag.toFixed(2)} €</span>
              </div>
            ))}
            <div className="flex justify-between font-semibold text-tanne-900 border-t border-tanne-900/15 pt-1 mt-1">
              <span>Gutschriftbetrag</span>
              <span>{summen.brutto.toFixed(2)} €</span>
            </div>
          </div>
        </div>

        <div className="mt-8 no-print">
          <label className="block text-xs font-medium text-tanne-900 mb-1">Notiz (intern)</label>
          <textarea
            disabled={gesperrt}
            value={gutschrift.notiz || ''}
            onChange={(e) => setGutschrift({ ...gutschrift, notiz: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm disabled:opacity-60"
          />
        </div>
      </div>
    </div>
  );
}
