import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import AttachmentsPanel from './AttachmentsPanel';
import logoUrl from '../assets/logo.svg';

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
  };
}

export default function DeliveryNoteEditor() {
  const { id } = useParams();
  const istNeu = id === 'neu';
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [kunden, setKunden] = useState([]);
  const [leistungen, setLeistungen] = useState([]);
  const [lieferschein, setLieferschein] = useState({
    id: null,
    customer_id: '',
    status: 'entwurf',
    lieferdatum: '',
    notiz: '',
    nummer: null,
  });
  const [positionen, setPositionen] = useState([neueLeerePosition()]);
  const [ladeVorgang, setLadeVorgang] = useState(true);
  const [speichertGerade, setSpeichertGerade] = useState(false);
  const [abschlussDialogOffen, setAbschlussDialogOffen] = useState(false);
  const [fehler, setFehler] = useState(null);

  const gesperrt = lieferschein.status !== 'entwurf';

  useEffect(() => {
    supabase.from('customers').select('id, name').order('name').then(({ data }) => setKunden(data || []));
    supabase
      .from('services')
      .select('*')
      .eq('aktiv', true)
      .order('bezeichnung')
      .then(({ data }) => setLeistungen(data || []));
  }, []);

  useEffect(() => {
    async function laden() {
      setLadeVorgang(true);
      if (istNeu) {
        setLadeVorgang(false);
        return;
      }
      const { data: ls } = await supabase.from('delivery_notes').select('*').eq('id', id).single();
      const { data: items } = await supabase
        .from('delivery_note_items')
        .select('*')
        .eq('delivery_note_id', id)
        .order('sortierung');
      setLieferschein(ls);
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
              einheit: leistung
                ? leistung.einheit_fix
                  ? leistung.einheit
                  : ''
                : p.einheit,
            }
          : p
      )
    );
  }

  async function speichern({ alsAbschluss = false } = {}) {
    setFehler(null);
    setSpeichertGerade(true);

    if (!lieferschein.customer_id) {
      setFehler('Bitte einen Kunden auswählen.');
      setSpeichertGerade(false);
      return;
    }

    const positionOhneEinheit = positionen.find(
      (p) => p.bezeichnung.trim() !== '' && !p.einheit
    );
    if (positionOhneEinheit) {
      setFehler(`Bitte bei „${positionOhneEinheit.bezeichnung}" eine Einheit auswählen.`);
      setSpeichertGerade(false);
      return;
    }

    const daten = {
      customer_id: lieferschein.customer_id,
      lieferdatum: lieferschein.lieferdatum || null,
      notiz: lieferschein.notiz || null,
    };

    let lieferscheinId = lieferschein.id;
    if (istNeu && !lieferscheinId) {
      const { data, error } = await supabase
        .from('delivery_notes')
        .insert({ ...daten, created_by: profile?.id })
        .select()
        .single();
      if (error) {
        setFehler('Speichern fehlgeschlagen: ' + error.message);
        setSpeichertGerade(false);
        return;
      }
      lieferscheinId = data.id;
      setLieferschein(data);
    } else {
      const { error } = await supabase.from('delivery_notes').update(daten).eq('id', lieferscheinId);
      if (error) {
        setFehler('Speichern fehlgeschlagen: ' + error.message);
        setSpeichertGerade(false);
        return;
      }
    }

    await supabase.from('delivery_note_items').delete().eq('delivery_note_id', lieferscheinId);
    const items = positionen
      .filter((p) => p.bezeichnung.trim() !== '')
      .map((p, idx) => ({
        delivery_note_id: lieferscheinId,
        service_id: p.service_id,
        bezeichnung: p.bezeichnung,
        menge: Number(p.menge || 0),
        einheit: p.einheit,
        sortierung: idx,
      }));
    if (items.length > 0) {
      const { error } = await supabase.from('delivery_note_items').insert(items);
      if (error) {
        setFehler('Positionen konnten nicht gespeichert werden: ' + error.message);
        setSpeichertGerade(false);
        return;
      }
    }

    if (alsAbschluss) {
      const { error } = await supabase.rpc('lieferschein_abschliessen', { p_id: lieferscheinId });
      if (error) {
        setFehler('Abschließen fehlgeschlagen: ' + error.message);
        setSpeichertGerade(false);
        return;
      }
    }

    setSpeichertGerade(false);
    navigate(`/lieferscheine/${lieferscheinId}`, { replace: true });
  }

  function alsRechnungUebernehmen() {
    navigate('/rechnungen/neu', {
      state: {
        vorlage: {
          customer_id: lieferschein.customer_id,
          items: positionen.map((p) => ({
            service_id: p.service_id,
            bezeichnung: p.bezeichnung,
            menge: p.menge,
            einheit: p.einheit,
            einzelpreis: leistungen.find((l) => l.id === p.service_id)?.standardpreis ?? 0,
          })),
        },
      },
    });
  }

  if (ladeVorgang) return <div className="p-4 sm:p-8 text-sm text-tanne-700/60">Lade…</div>;

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <div className="no-print flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-tanne-900">
            {istNeu ? 'Neuer Lieferschein' : lieferschein.nummer || 'Lieferschein-Entwurf'}
          </h1>
          {gesperrt && (
            <p className="text-xs text-moos font-medium mt-1">🔒 Abgeschlossen – nicht mehr veränderbar</p>
          )}
        </div>
        <div className="flex gap-2">
          {!gesperrt && (
            <>
              <button
                onClick={() => speichern({ alsAbschluss: false })}
                disabled={speichertGerade}
                className="rounded-lg border border-tanne-900/20 text-tanne-900 text-sm font-medium px-4 py-2 hover:bg-tanne-900/5 disabled:opacity-60"
              >
                Entwurf speichern
              </button>
              <button
                onClick={() => setAbschlussDialogOffen(true)}
                disabled={speichertGerade}
                className="rounded-lg bg-tanne-800 text-papier text-sm font-medium px-4 py-2 hover:bg-tanne-700 disabled:opacity-60"
              >
                Abschließen
              </button>
            </>
          )}
          {gesperrt && (
            <>
              <button
                onClick={alsRechnungUebernehmen}
                className="rounded-lg border border-tanne-900/20 text-tanne-900 text-sm font-medium px-4 py-2 hover:bg-tanne-900/5"
              >
                In Rechnung übernehmen
              </button>
              <button
                onClick={() => window.print()}
                className="rounded-lg bg-tanne-800 text-papier text-sm font-medium px-4 py-2 hover:bg-tanne-700"
              >
                Drucken / Als PDF speichern
              </button>
            </>
          )}
        </div>
      </div>

      {fehler && <p className="no-print text-sm text-rost mb-4">{fehler}</p>}

      <div className="print-area bg-white rounded-xl border border-tanne-900/10 shadow-sm p-8">
        <div className="flex justify-between mb-8">
          <div className="flex items-center gap-4">
            <img src={logoUrl} alt="Forstservice Elsasser Logo" className="h-16 w-auto shrink-0" />
            <div>
              <p className="font-display text-lg font-semibold text-tanne-900">Forstservice</p>
              <p className="text-xs text-tanne-700/60 mt-1">Lieferschein</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p className="text-tanne-900/60">Lieferschein-Nr.</p>
            <p className="font-mono font-medium text-tanne-900">
              {lieferschein.nummer || '— wird bei Abschluss vergeben —'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8 no-print">
          <div>
            <label className="block text-xs font-medium text-tanne-900 mb-1">Kunde *</label>
            <select
              disabled={gesperrt}
              value={lieferschein.customer_id || ''}
              onChange={(e) => setLieferschein({ ...lieferschein, customer_id: e.target.value })}
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
            <label className="block text-xs font-medium text-tanne-900 mb-1">Lieferdatum (optional)</label>
            <input
              type="date"
              disabled={gesperrt}
              value={lieferschein.lieferdatum || ''}
              onChange={(e) => setLieferschein({ ...lieferschein, lieferdatum: e.target.value })}
              className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm disabled:opacity-60"
            />
          </div>
        </div>

        <div className="mb-4 text-sm">
          <p className="text-tanne-900/60">Für</p>
          <p className="font-medium text-tanne-900">
            {kunden.find((k) => k.id === lieferschein.customer_id)?.name || '—'}
          </p>
        </div>

        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="border-b border-tanne-900/15 text-xs uppercase tracking-wide text-tanne-900/60">
              <th className="text-left py-2">Bezeichnung</th>
              <th className="text-right py-2 w-24">Menge</th>
              <th className="text-left py-2 w-24 no-print">Einheit</th>
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
                  <span className="text-xs text-tanne-700/50 print:inline hidden ml-1">
                    {EINHEIT_LABEL[p.einheit]}
                  </span>
                </td>
                <td className="py-2 no-print">
                  <select
                    disabled={gesperrt}
                    required
                    value={p.einheit || ''}
                    onChange={(e) => positionAendern(idx, 'einheit', e.target.value)}
                    className={`w-full text-xs border-0 bg-transparent py-1 ${
                      !p.einheit ? 'text-rost' : ''
                    }`}
                  >
                    <option value="" disabled>
                      — wählen —
                    </option>
                    {Object.entries(EINHEIT_LABEL).map(([wert, label]) => (
                      <option key={wert} value={wert}>
                        {label || wert}
                      </option>
                    ))}
                  </select>
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

        <div className="mt-8 no-print">
          <label className="block text-xs font-medium text-tanne-900 mb-1">Notiz</label>
          <textarea
            disabled={gesperrt}
            value={lieferschein.notiz || ''}
            onChange={(e) => setLieferschein({ ...lieferschein, notiz: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm disabled:opacity-60"
          />
        </div>

        <div className="mt-6 no-print border-t border-tanne-900/10 pt-4">
          <AttachmentsPanel entityType="delivery_note" entityId={lieferschein.id} />
        </div>
      </div>

      {abschlussDialogOffen && (
        <div className="fixed inset-0 bg-tanne-950/40 flex items-center justify-center p-4 z-30 no-print">
          <div className="bg-papier rounded-xl shadow-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="font-display text-lg font-semibold text-tanne-900 mb-1">
              Lieferschein abschließen?
            </h2>
            <p className="text-sm text-tanne-700/70 mb-4">
              Nach dem Abschließen wird die Lieferschein-Nummer vergeben und der
              Lieferschein kann nicht mehr geändert werden. Bitte prüfe die Angaben.
            </p>

            <div className="rounded-lg border border-tanne-900/10 bg-white/70 divide-y divide-tanne-900/5 text-sm mb-4">
              <div className="flex justify-between px-4 py-2">
                <span className="text-tanne-700/70">Kunde</span>
                <span className="font-medium text-tanne-900 text-right">
                  {kunden.find((k) => k.id === lieferschein.customer_id)?.name || '— fehlt —'}
                </span>
              </div>
              <div className="flex justify-between px-4 py-2">
                <span className="text-tanne-700/70">Lieferdatum</span>
                <span className="text-tanne-900 text-right">
                  {lieferschein.lieferdatum
                    ? new Date(lieferschein.lieferdatum).toLocaleDateString('de-DE')
                    : '— nicht gesetzt —'}
                </span>
              </div>
              <div className="flex justify-between px-4 py-2">
                <span className="text-tanne-700/70">Positionen</span>
                <span className="text-tanne-900 text-right">
                  {positionen.filter((p) => p.bezeichnung.trim() !== '').length}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setAbschlussDialogOffen(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-tanne-900/70 hover:bg-tanne-900/5"
              >
                Zurück &amp; bearbeiten
              </button>
              <button
                onClick={() => {
                  setAbschlussDialogOffen(false);
                  speichern({ alsAbschluss: true });
                }}
                disabled={speichertGerade}
                className="rounded-lg bg-moos text-white text-sm font-medium px-4 py-2 hover:opacity-90 disabled:opacity-60"
              >
                Ja, verbindlich abschließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
