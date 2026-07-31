import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { csvExportieren } from '../lib/csvExport';

const STATUS_LABEL = {
  entwurf: { text: 'Entwurf', klasse: 'bg-tanne-900/10 text-tanne-900/70' },
  freigegeben: { text: 'Freigegeben', klasse: 'bg-moos/25 text-tanne-800' },
  bezahlt: { text: 'Bezahlt', klasse: 'bg-tanne-700/20 text-tanne-800' },
  storniert: { text: 'Storniert', klasse: 'bg-rost/15 text-rost' },
};

export default function InvoicesPage() {
  const { istAdminOderBuchhaltung } = useAuth();
  const [rechnungen, setRechnungen] = useState([]);
  const [ladeVorgang, setLadeVorgang] = useState(true);
  const [fehler, setFehler] = useState(null);

  async function laden() {
    setLadeVorgang(true);
    const { data, error } = await supabase
      .from('invoices')
      .select('id, nummer, status, rechnungsdatum, created_at, customers(name)')
      .order('created_at', { ascending: false });
    if (!error) setRechnungen(data);
    setLadeVorgang(false);
  }

  useEffect(() => {
    laden();
  }, []);

  async function markiereAlsBezahlt(id) {
    const { error } = await supabase
      .from('invoices')
      .update({ status: 'bezahlt' })
      .eq('id', id);
    if (error) setFehler('Konnte nicht als bezahlt markiert werden: ' + error.message);
    laden();
  }

  async function csvHerunterladen() {
    const ids = rechnungen.map((r) => r.id);
    const { data: items } = await supabase
      .from('invoice_items')
      .select('invoice_id, menge, einzelpreis, ust_satz')
      .in('invoice_id', ids);

    const summenProRechnung = {};
    (items || []).forEach((it) => {
      const netto = Number(it.menge) * Number(it.einzelpreis);
      const brutto = netto * (1 + Number(it.ust_satz) / 100);
      if (!summenProRechnung[it.invoice_id]) {
        summenProRechnung[it.invoice_id] = { netto: 0, brutto: 0 };
      }
      summenProRechnung[it.invoice_id].netto += netto;
      summenProRechnung[it.invoice_id].brutto += brutto;
    });

    csvExportieren(
      'rechnungen-export.csv',
      ['Nummer', 'Kunde', 'Datum', 'Status', 'Netto', 'Brutto'],
      rechnungen.map((r) => [
        r.nummer || 'Entwurf',
        r.customers?.name || '',
        r.rechnungsdatum ? new Date(r.rechnungsdatum).toLocaleDateString('de-DE') : '',
        STATUS_LABEL[r.status].text,
        (summenProRechnung[r.id]?.netto ?? 0).toFixed(2),
        (summenProRechnung[r.id]?.brutto ?? 0).toFixed(2),
      ])
    );
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-tanne-900">Rechnungen</h1>
          <p className="text-sm text-tanne-700/70">Entwürfe, freigegebene und bezahlte Rechnungen</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={csvHerunterladen}
            className="rounded-lg border border-tanne-900/20 text-tanne-900 text-sm font-medium px-4 py-2 hover:bg-tanne-900/5"
          >
            CSV exportieren
          </button>
          <Link
            to="/rechnungen/neu"
            className="rounded-lg bg-tanne-800 text-papier text-sm font-medium px-4 py-2 hover:bg-tanne-700 transition-colors"
          >
            + Neue Rechnung
          </Link>
        </div>
      </div>

      {fehler && <p className="text-sm text-rost mb-4">{fehler}</p>}

      {ladeVorgang ? (
        <p className="text-sm text-tanne-700/60">Lade Rechnungen…</p>
      ) : rechnungen.length === 0 ? (
        <div className="rounded-xl border border-dashed border-tanne-900/20 p-8 text-center text-tanne-700/60">
          Noch keine Rechnungen vorhanden. Leg mit „+ Neue Rechnung" die erste an.
        </div>
      ) : (
        <div className="rounded-xl border border-tanne-900/10 bg-white/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-tanne-900/5 text-tanne-900/70 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Nummer</th>
                <th className="text-left px-4 py-3 font-medium">Kunde</th>
                <th className="text-left px-4 py-3 font-medium">Datum</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rechnungen.map((r) => (
                <tr key={r.id} className="border-t border-tanne-900/5 hover:bg-tanne-900/[0.03]">
                  <td className="px-4 py-3 font-mono text-xs text-tanne-900">
                    {r.nummer || <span className="text-tanne-700/40">— Entwurf —</span>}
                  </td>
                  <td className="px-4 py-3 text-tanne-900/90">{r.customers?.name || '–'}</td>
                  <td className="px-4 py-3 text-tanne-900/80">
                    {r.rechnungsdatum
                      ? new Date(r.rechnungsdatum).toLocaleDateString('de-DE')
                      : '–'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_LABEL[r.status].klasse}`}
                    >
                      {STATUS_LABEL[r.status].text}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    {istAdminOderBuchhaltung && r.status === 'freigegeben' && (
                      <button
                        onClick={() => markiereAlsBezahlt(r.id)}
                        className="text-tanne-700 hover:underline text-xs font-medium"
                      >
                        Als bezahlt markieren
                      </button>
                    )}
                    <Link
                      to={`/rechnungen/${r.id}`}
                      className="text-tanne-700 hover:underline text-xs font-medium"
                    >
                      {r.status === 'entwurf' ? 'Bearbeiten' : 'Ansehen'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
