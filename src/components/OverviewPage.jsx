import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { csvExportieren } from '../lib/csvExport';

export default function OverviewPage() {
  const [jahr, setJahr] = useState(new Date().getFullYear());
  const [rechnungen, setRechnungen] = useState([]);
  const [ausgaben, setAusgaben] = useState([]);
  const [ladeVorgang, setLadeVorgang] = useState(true);

  async function laden() {
    setLadeVorgang(true);
    const vonDatum = `${jahr}-01-01`;
    const bisDatum = `${jahr}-12-31`;

    const { data: invs } = await supabase
      .from('invoices')
      .select('id, nummer, rechnungsdatum, status')
      .eq('status', 'bezahlt')
      .gte('rechnungsdatum', vonDatum)
      .lte('rechnungsdatum', bisDatum);

    const ids = (invs || []).map((i) => i.id);
    const { data: items } = ids.length
      ? await supabase.from('invoice_items').select('invoice_id, menge, einzelpreis').in('invoice_id', ids)
      : { data: [] };

    const summenProRechnung = {};
    (items || []).forEach((it) => {
      const netto = Number(it.menge) * Number(it.einzelpreis);
      summenProRechnung[it.invoice_id] = (summenProRechnung[it.invoice_id] || 0) + netto;
    });

    setRechnungen(
      (invs || []).map((i) => ({ ...i, betrag: summenProRechnung[i.id] || 0 }))
    );

    const { data: exps } = await supabase
      .from('expenses')
      .select('*')
      .gte('datum', vonDatum)
      .lte('datum', bisDatum);
    setAusgaben(exps || []);

    setLadeVorgang(false);
  }

  useEffect(() => {
    laden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jahr]);

  const monatsWerte = useMemo(() => {
    const monate = Array.from({ length: 12 }, (_, i) => ({
      monat: i + 1,
      einnahmen: 0,
      ausgaben: 0,
    }));
    rechnungen.forEach((r) => {
      const m = new Date(r.rechnungsdatum).getMonth();
      monate[m].einnahmen += r.betrag;
    });
    ausgaben.forEach((a) => {
      const m = new Date(a.datum).getMonth();
      monate[m].ausgaben += Number(a.betrag);
    });
    return monate;
  }, [rechnungen, ausgaben]);

  const gesamtEinnahmen = monatsWerte.reduce((s, m) => s + m.einnahmen, 0);
  const gesamtAusgaben = monatsWerte.reduce((s, m) => s + m.ausgaben, 0);

  const MONATS_NAMEN = [
    'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
  ];

  function csvHerunterladen() {
    csvExportieren(
      `einnahmen-ausgaben-${jahr}.csv`,
      ['Monat', 'Einnahmen (netto)', 'Ausgaben', 'Saldo'],
      monatsWerte.map((m) => [
        MONATS_NAMEN[m.monat - 1],
        m.einnahmen.toFixed(2),
        m.ausgaben.toFixed(2),
        (m.einnahmen - m.ausgaben).toFixed(2),
      ])
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-tanne-900">Einnahmen &amp; Ausgaben</h1>
          <p className="text-sm text-tanne-700/70">
            Bezahlte Rechnungen (netto) vs. erfasste Ausgaben, nach Monat
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={jahr}
            onChange={(e) => setJahr(Number(e.target.value))}
            className="rounded-lg border border-tanne-900/15 px-3 py-2 text-sm bg-white"
          >
            {[jahr + 1, jahr, jahr - 1, jahr - 2].map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>
          <button
            onClick={csvHerunterladen}
            className="rounded-lg border border-tanne-900/20 text-tanne-900 text-sm font-medium px-4 py-2 hover:bg-tanne-900/5"
          >
            CSV exportieren
          </button>
        </div>
      </div>

      {ladeVorgang ? (
        <p className="text-sm text-tanne-700/60">Lade…</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="rounded-xl border border-tanne-900/10 bg-white/60 p-4">
              <p className="text-xs text-tanne-700/60 mb-1">Einnahmen (netto)</p>
              <p className="text-xl font-semibold text-tanne-900">{gesamtEinnahmen.toFixed(2)} €</p>
            </div>
            <div className="rounded-xl border border-tanne-900/10 bg-white/60 p-4">
              <p className="text-xs text-tanne-700/60 mb-1">Ausgaben</p>
              <p className="text-xl font-semibold text-tanne-900">{gesamtAusgaben.toFixed(2)} €</p>
            </div>
            <div className="rounded-xl border border-tanne-900/10 bg-white/60 p-4">
              <p className="text-xs text-tanne-700/60 mb-1">Saldo</p>
              <p
                className={`text-xl font-semibold ${
                  gesamtEinnahmen - gesamtAusgaben >= 0 ? 'text-tanne-900' : 'text-rost'
                }`}
              >
                {(gesamtEinnahmen - gesamtAusgaben).toFixed(2)} €
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-tanne-900/10 bg-white/60 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-tanne-900/5 text-tanne-900/70 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Monat</th>
                  <th className="text-right px-4 py-3 font-medium">Einnahmen</th>
                  <th className="text-right px-4 py-3 font-medium">Ausgaben</th>
                  <th className="text-right px-4 py-3 font-medium">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {monatsWerte.map((m) => (
                  <tr key={m.monat} className="border-t border-tanne-900/5">
                    <td className="px-4 py-2 text-tanne-900/90">{MONATS_NAMEN[m.monat - 1]}</td>
                    <td className="px-4 py-2 text-right text-tanne-900/80">{m.einnahmen.toFixed(2)} €</td>
                    <td className="px-4 py-2 text-right text-tanne-900/80">{m.ausgaben.toFixed(2)} €</td>
                    <td className="px-4 py-2 text-right font-medium text-tanne-900">
                      {(m.einnahmen - m.ausgaben).toFixed(2)} €
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
