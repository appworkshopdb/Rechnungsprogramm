import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { csvExportieren } from '../lib/csvExport';
import { datevExportErzeugen } from '../lib/datevExport';

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

  // Entwürfe links, freigegebene/bezahlte/stornierte rechts — jeweils
  // neueste zuerst (die Grundabfrage sortiert bereits nach created_at desc).
  const entwuerfe = rechnungen.filter((r) => r.status === 'entwurf');
  const freigegebene = rechnungen.filter((r) => r.status !== 'entwurf');

  async function markiereAlsBezahlt(id) {
    const { error } = await supabase
      .from('invoices')
      .update({ status: 'bezahlt' })
      .eq('id', id);
    if (error) setFehler('Konnte nicht als bezahlt markiert werden: ' + error.message);
    laden();
  }

  async function summenProRechnungBerechnen() {
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
    return summenProRechnung;
  }

  async function csvHerunterladen() {
    const summenProRechnung = await summenProRechnungBerechnen();

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

  async function datevHerunterladen() {
    const summenProRechnung = await summenProRechnungBerechnen();
    datevExportErzeugen(rechnungen, summenProRechnung);
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
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
          <button
            onClick={datevHerunterladen}
            className="rounded-lg border border-tanne-900/20 text-tanne-900 text-sm font-medium px-4 py-2 hover:bg-tanne-900/5"
          >
            Buchhaltungsexport
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SpalteRechnungen
            titel="Entwürfe"
            rechnungen={entwuerfe}
            leerText="Keine Entwürfe."
            istAdminOderBuchhaltung={istAdminOderBuchhaltung}
            markiereAlsBezahlt={markiereAlsBezahlt}
          />
          <SpalteRechnungen
            titel="Freigegeben & bezahlt"
            rechnungen={freigegebene}
            leerText="Noch keine freigegebenen Rechnungen."
            istAdminOderBuchhaltung={istAdminOderBuchhaltung}
            markiereAlsBezahlt={markiereAlsBezahlt}
          />
        </div>
      )}
    </div>
  );
}

function SpalteRechnungen({ titel, rechnungen, leerText, istAdminOderBuchhaltung, markiereAlsBezahlt }) {
  return (
    <div>
      <h2 className="text-xs font-semibold text-tanne-700 uppercase tracking-wide mb-2">
        {titel} <span className="text-tanne-700/50">({rechnungen.length})</span>
      </h2>
      {rechnungen.length === 0 ? (
        <div className="rounded-xl border border-dashed border-tanne-900/15 p-6 text-center text-sm text-tanne-700/50">
          {leerText}
        </div>
      ) : (
        <div className="space-y-2">
          {rechnungen.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-tanne-900/10 bg-white/60 px-4 py-3 hover:bg-tanne-900/[0.03]"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-tanne-900 truncate">{r.customers?.name || '–'}</p>
                  <p className="text-xs text-tanne-700/60 font-mono mt-0.5">
                    {r.nummer || '— Entwurf —'}
                    {r.rechnungsdatum && (
                      <span className="ml-2">
                        {new Date(r.rechnungsdatum).toLocaleDateString('de-DE')}
                      </span>
                    )}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_LABEL[r.status].klasse}`}
                >
                  {STATUS_LABEL[r.status].text}
                </span>
              </div>
              <div className="flex items-center justify-end gap-3 mt-2">
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
