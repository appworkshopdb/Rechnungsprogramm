import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { xrechnungXmlErzeugen, xmlHerunterladen } from '../lib/xrechnung';
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
    einzelpreis: 0,
    ust_satz: 19,
  };
}

export default function InvoiceEditor() {
  const { id } = useParams();
  const istNeu = id === 'neu';
  const navigate = useNavigate();
  const location = useLocation();
  const { istAdminOderBuchhaltung, profile } = useAuth();

  const [kunden, setKunden] = useState([]);
  const [leistungen, setLeistungen] = useState([]);
  const [firma, setFirma] = useState(null);
  const [rechnung, setRechnung] = useState({
    id: null,
    customer_id: '',
    status: 'entwurf',
    rechnungsdatum: '',
    leistungszeitraum_von: '',
    leistungszeitraum_bis: '',
    notiz: '',
    nummer: null,
    created_by: null,
  });
  const [positionen, setPositionen] = useState([neueLeerePosition()]);
  const [ladeVorgang, setLadeVorgang] = useState(true);
  const [speichertGerade, setSpeichertGerade] = useState(false);
  const [fehler, setFehler] = useState(null);
  const [hinweis, setHinweis] = useState(null);

  const gesperrt = rechnung.status !== 'entwurf';

  useEffect(() => {
    async function grunddatenLaden() {
      const [{ data: k }, { data: l }, { data: f }] = await Promise.all([
        supabase
          .from('customers')
          .select('id, name, strasse, plz, ort, kundentyp, leitweg_id')
          .order('name'),
        supabase.from('services').select('*').eq('aktiv', true).order('bezeichnung'),
        supabase.from('company_settings').select('*').eq('id', 1).single(),
      ]);
      setKunden(k || []);
      setLeistungen(l || []);
      setFirma(f || null);
    }
    grunddatenLaden();
  }, []);

  useEffect(() => {
    async function rechnungLaden() {
      setLadeVorgang(true);

      if (istNeu) {
        // Aus einer Vorlage heraus gestartet? (via navigate state)
        const vorlage = location.state?.vorlage;
        if (vorlage) {
          setRechnung((r) => ({ ...r, customer_id: vorlage.customer_id || '' }));
          setPositionen(
            (vorlage.items || []).map((it) => ({
              id: `neu-${Math.random().toString(36).slice(2)}`,
              service_id: it.service_id,
              bezeichnung: it.bezeichnung,
              menge: it.menge,
              einheit: it.einheit,
              einzelpreis: it.einzelpreis,
              ust_satz: 19,
            }))
          );
        }
        setLadeVorgang(false);
        return;
      }

      const { data: inv, error: invFehler } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', id)
        .single();

      if (invFehler) {
        setFehler('Rechnung konnte nicht geladen werden.');
        setLadeVorgang(false);
        return;
      }

      const { data: items } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', id)
        .order('sortierung');

      setRechnung(inv);
      setPositionen(items && items.length ? items : [neueLeerePosition()]);
      setLadeVorgang(false);
    }
    rechnungLaden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function positionAendern(idx, feld, wert) {
    setPositionen((liste) =>
      liste.map((p, i) => (i === idx ? { ...p, [feld]: wert } : p))
    );
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

  function positionEntfernen(idx) {
    setPositionen((liste) => liste.filter((_, i) => i !== idx));
  }

  function positionHinzufuegen() {
    setPositionen((liste) => [...liste, neueLeerePosition()]);
  }

  const summen = useMemo(() => {
    const netto = positionen.reduce(
      (sum, p) => sum + Number(p.menge || 0) * Number(p.einzelpreis || 0),
      0
    );
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

    if (!rechnung.customer_id) {
      setFehler('Bitte einen Kunden auswählen.');
      setSpeichertGerade(false);
      return;
    }

    const rechnungsDaten = {
      customer_id: rechnung.customer_id,
      rechnungsdatum: rechnung.rechnungsdatum || null,
      leistungszeitraum_von: rechnung.leistungszeitraum_von || null,
      leistungszeitraum_bis: rechnung.leistungszeitraum_bis || null,
      notiz: rechnung.notiz || null,
    };

    let rechnungId = rechnung.id;

    if (istNeu && !rechnungId) {
      const { data, error } = await supabase
        .from('invoices')
        .insert({ ...rechnungsDaten, created_by: profile?.id })
        .select()
        .single();
      if (error) {
        setFehler('Speichern fehlgeschlagen: ' + error.message);
        setSpeichertGerade(false);
        return;
      }
      rechnungId = data.id;
      setRechnung(data);
    } else {
      const { error } = await supabase
        .from('invoices')
        .update(rechnungsDaten)
        .eq('id', rechnungId);
      if (error) {
        setFehler('Speichern fehlgeschlagen: ' + error.message);
        setSpeichertGerade(false);
        return;
      }
    }

    // Bestehende Positionen ersetzen: einfach & robust für den MVP
    await supabase.from('invoice_items').delete().eq('invoice_id', rechnungId);
    const einzufuegendePositionen = positionen
      .filter((p) => p.bezeichnung.trim() !== '')
      .map((p, idx) => ({
        invoice_id: rechnungId,
        service_id: p.service_id,
        bezeichnung: p.bezeichnung,
        menge: Number(p.menge || 0),
        einheit: p.einheit,
        einzelpreis: Number(p.einzelpreis || 0),
        ust_satz: Number(p.ust_satz || 0),
        sortierung: idx,
      }));
    if (einzufuegendePositionen.length > 0) {
      const { error } = await supabase.from('invoice_items').insert(einzufuegendePositionen);
      if (error) {
        setFehler('Positionen konnten nicht gespeichert werden: ' + error.message);
        setSpeichertGerade(false);
        return;
      }
    }

    if (alsFreigabe) {
      const { error } = await supabase.rpc('rechnung_freigeben', { p_invoice_id: rechnungId });
      if (error) {
        setFehler('Freigabe fehlgeschlagen: ' + error.message);
        setSpeichertGerade(false);
        return;
      }
    }

    setSpeichertGerade(false);
    setHinweis(alsFreigabe ? 'Rechnung freigegeben.' : 'Entwurf gespeichert.');
    navigate(`/rechnungen/${rechnungId}`, { replace: true });
  }

  function xrechnungHerunterladen() {
    const kunde = kunden.find((k) => k.id === rechnung.customer_id);
    if (!kunde || !firma) return;
    const xml = xrechnungXmlErzeugen(rechnung, positionen, kunde, firma);
    xmlHerunterladen(`${rechnung.nummer || 'rechnung'}.xml`, xml);
  }

  if (ladeVorgang) {
    return <div className="p-8 text-sm text-tanne-700/60">Lade…</div>;
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="no-print flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-tanne-900">
            {istNeu ? 'Neue Rechnung' : rechnung.nummer || 'Rechnungsentwurf'}
          </h1>
          {gesperrt && (
            <p className="text-xs text-moos font-medium mt-1">
              🔒 Freigegeben – inhaltlich nicht mehr veränderbar (GoBD)
            </p>
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
            <>
              <button
                onClick={xrechnungHerunterladen}
                className="rounded-lg border border-tanne-900/20 text-tanne-900 text-sm font-medium px-4 py-2 hover:bg-tanne-900/5"
              >
                XRechnung (XML)
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
      {hinweis && <p className="no-print text-sm text-moos mb-4">{hinweis}</p>}

      <div className="print-area bg-white rounded-xl border border-tanne-900/10 shadow-sm p-8">
        <div className="flex justify-between mb-8">
          <div className="flex items-center gap-4">
            <img src={logoUrl} alt="Forstservice Elsasser Logo" className="h-16 w-auto shrink-0" />
            <div>
              <p className="font-display text-lg font-semibold text-tanne-900">
                {firma?.firmenname || 'Forstservice'}
              </p>
              <p className="text-xs text-tanne-700/60 mt-1">
                {firma?.strasse && <>{firma.strasse}<br /></>}
                {(firma?.plz || firma?.ort) && <>{firma.plz} {firma.ort}<br /></>}
                {firma?.ust_idnr && <>USt-IdNr.: {firma.ust_idnr}</>}
              </p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p className="text-tanne-900/60">Rechnungsnummer</p>
            <p className="font-mono font-medium text-tanne-900">
              {rechnung.nummer || '— wird bei Freigabe vergeben —'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8 no-print">
          <div>
            <label className="block text-xs font-medium text-tanne-900 mb-1">Kunde *</label>
            <select
              disabled={gesperrt}
              value={rechnung.customer_id || ''}
              onChange={(e) => setRechnung({ ...rechnung, customer_id: e.target.value })}
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
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-tanne-900 mb-1">
                Datum (optional)
              </label>
              <input
                type="date"
                disabled={gesperrt}
                value={rechnung.rechnungsdatum || ''}
                onChange={(e) => setRechnung({ ...rechnung, rechnungsdatum: e.target.value })}
                className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-tanne-900 mb-1">Zeitraum von</label>
              <input
                type="date"
                disabled={gesperrt}
                value={rechnung.leistungszeitraum_von || ''}
                onChange={(e) =>
                  setRechnung({ ...rechnung, leistungszeitraum_von: e.target.value })
                }
                className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-tanne-900 mb-1">bis</label>
              <input
                type="date"
                disabled={gesperrt}
                value={rechnung.leistungszeitraum_bis || ''}
                onChange={(e) =>
                  setRechnung({ ...rechnung, leistungszeitraum_bis: e.target.value })
                }
                className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm disabled:opacity-60"
              />
            </div>
          </div>
        </div>

        <div className="mb-4 text-sm">
          <p className="text-tanne-900/60">Rechnung an</p>
          <p className="font-medium text-tanne-900">
            {kunden.find((k) => k.id === rechnung.customer_id)?.name || '—'}
          </p>
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
                    <option value="">— Leistung aus Katalog übernehmen —</option>
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
                    placeholder="Bezeichnung der Position"
                    className="w-full border-0 border-b border-transparent focus:border-tanne-900/20 bg-transparent px-0 py-1 text-sm disabled:opacity-90"
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
                      onClick={() => positionEntfernen(idx)}
                      className="text-rost text-xs"
                      title="Position entfernen"
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
            onClick={positionHinzufuegen}
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
              <span>Gesamtbetrag</span>
              <span>{summen.brutto.toFixed(2)} €</span>
            </div>
          </div>
        </div>

        <div className="mt-8 no-print">
          <label className="block text-xs font-medium text-tanne-900 mb-1">
            Notiz (nur intern sichtbar)
          </label>
          <textarea
            disabled={gesperrt}
            value={rechnung.notiz || ''}
            onChange={(e) => setRechnung({ ...rechnung, notiz: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm disabled:opacity-60"
          />
        </div>

        <div className="mt-6 no-print border-t border-tanne-900/10 pt-4">
          <AttachmentsPanel entityType="invoice" entityId={rechnung.id} />
        </div>
      </div>
    </div>
  );
}
