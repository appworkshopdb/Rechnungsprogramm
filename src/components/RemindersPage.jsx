import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';

const MAHNTEXTE = {
  1: 'Wir möchten Sie freundlich daran erinnern, dass die unten genannte Rechnung noch offen ist. Wir bitten um Ausgleich innerhalb der nächsten 14 Tage.',
  2: 'Trotz unserer ersten Erinnerung ist die unten genannte Rechnung weiterhin offen. Wir bitten Sie, den Betrag umgehend zu begleichen.',
  3: 'Die unten genannte Rechnung ist trotz zweimaliger Erinnerung weiterhin unbeglichen. Wir bitten letztmalig um Zahlung innerhalb von 7 Tagen.',
};

export default function RemindersPage() {
  const { profile } = useAuth();
  const [rechnungen, setRechnungen] = useState([]);
  const [mahnungenProRechnung, setMahnungenProRechnung] = useState({});
  const [ladeVorgang, setLadeVorgang] = useState(true);
  const [ausgewaehlt, setAusgewaehlt] = useState(null);
  const [mahnstufe, setMahnstufe] = useState(1);
  const [mahngebuehr, setMahngebuehr] = useState(5);
  const [mahntext, setMahntext] = useState(MAHNTEXTE[1]);
  const [fehler, setFehler] = useState(null);
  const [druckAnsicht, setDruckAnsicht] = useState(null);

  async function laden() {
    setLadeVorgang(true);
    const { data: invs } = await supabase
      .from('invoices')
      .select('id, nummer, rechnungsdatum, customers(name, strasse, plz, ort)')
      .eq('status', 'freigegeben')
      .order('rechnungsdatum', { ascending: true });
    setRechnungen(invs || []);

    const { data: reminders } = await supabase
      .from('reminders')
      .select('invoice_id, mahnstufe, created_at')
      .order('created_at', { ascending: false });
    const gruppiert = {};
    (reminders || []).forEach((r) => {
      if (!gruppiert[r.invoice_id]) gruppiert[r.invoice_id] = [];
      gruppiert[r.invoice_id].push(r);
    });
    setMahnungenProRechnung(gruppiert);
    setLadeVorgang(false);
  }

  useEffect(() => {
    laden();
  }, []);

  function mahnungVorbereiten(rechnung) {
    const bisherige = mahnungenProRechnung[rechnung.id] || [];
    const naechsteStufe = Math.min(bisherige.length + 1, 3);
    setAusgewaehlt(rechnung);
    setMahnstufe(naechsteStufe);
    setMahntext(MAHNTEXTE[naechsteStufe]);
    setMahngebuehr(naechsteStufe === 1 ? 0 : 5);
    setFehler(null);
  }

  async function mahnungSpeichernUndDrucken() {
    setFehler(null);
    const { error } = await supabase.from('reminders').insert({
      invoice_id: ausgewaehlt.id,
      mahnstufe,
      mahngebuehr: Number(mahngebuehr),
      mahntext,
      erstellt_von: profile?.id,
    });
    if (error) {
      setFehler('Speichern fehlgeschlagen: ' + error.message);
      return;
    }
    setDruckAnsicht({ rechnung: ausgewaehlt, mahnstufe, mahngebuehr, mahntext });
    setAusgewaehlt(null);
    laden();
  }

  if (druckAnsicht) {
    return (
      <div className="p-4 sm:p-8 max-w-3xl">
        <div className="no-print mb-4 flex gap-2">
          <button
            onClick={() => setDruckAnsicht(null)}
            className="rounded-lg border border-tanne-900/20 text-tanne-900 text-sm font-medium px-4 py-2 hover:bg-tanne-900/5"
          >
            Zurück zur Übersicht
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-tanne-800 text-papier text-sm font-medium px-4 py-2 hover:bg-tanne-700"
          >
            Drucken / Als PDF speichern
          </button>
        </div>
        <div className="print-area bg-white rounded-xl border border-tanne-900/10 shadow-sm p-8">
          <p className="font-display text-lg font-semibold text-tanne-900 mb-1">Forstservice</p>
          <p className="text-xs text-tanne-700/60 mb-8">
            {druckAnsicht.mahnstufe}. Mahnung zu Rechnung {druckAnsicht.rechnung.nummer}
          </p>

          <p className="text-sm text-tanne-900 mb-1">{druckAnsicht.rechnung.customers?.name}</p>
          <p className="text-sm text-tanne-900/70 mb-8">
            {druckAnsicht.rechnung.customers?.strasse}
            <br />
            {druckAnsicht.rechnung.customers?.plz} {druckAnsicht.rechnung.customers?.ort}
          </p>

          <p className="text-sm font-semibold text-tanne-900 mb-4">
            {druckAnsicht.mahnstufe}. Mahnung – Rechnung {druckAnsicht.rechnung.nummer}
          </p>
          <p className="text-sm text-tanne-900/90 whitespace-pre-line mb-6">{druckAnsicht.mahntext}</p>

          {druckAnsicht.mahngebuehr > 0 && (
            <p className="text-sm text-tanne-900">
              Mahngebühr: <strong>{Number(druckAnsicht.mahngebuehr).toFixed(2)} €</strong>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-tanne-900">Mahnungen</h1>
        <p className="text-sm text-tanne-700/70">
          Freigegebene, noch nicht als bezahlt markierte Rechnungen
        </p>
      </div>

      {fehler && <p className="text-sm text-rost mb-4">{fehler}</p>}

      {ladeVorgang ? (
        <p className="text-sm text-tanne-700/60">Lade…</p>
      ) : rechnungen.length === 0 ? (
        <div className="rounded-xl border border-dashed border-tanne-900/20 p-8 text-center text-tanne-700/60">
          Keine offenen Rechnungen — entweder alles bezahlt oder noch nichts freigegeben.
        </div>
      ) : (
        <div className="rounded-xl border border-tanne-900/10 bg-white/60 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-tanne-900/5 text-tanne-900/70 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Nummer</th>
                <th className="text-left px-4 py-3 font-medium">Kunde</th>
                <th className="text-left px-4 py-3 font-medium">Datum</th>
                <th className="text-left px-4 py-3 font-medium">Bisherige Mahnungen</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rechnungen.map((r) => (
                <tr key={r.id} className="border-t border-tanne-900/5 hover:bg-tanne-900/[0.03]">
                  <td className="px-4 py-3 font-mono text-xs text-tanne-900">{r.nummer}</td>
                  <td className="px-4 py-3 text-tanne-900/90">{r.customers?.name}</td>
                  <td className="px-4 py-3 text-tanne-900/80">
                    {r.rechnungsdatum ? new Date(r.rechnungsdatum).toLocaleDateString('de-DE') : '–'}
                  </td>
                  <td className="px-4 py-3 text-tanne-900/80">
                    {(mahnungenProRechnung[r.id] || []).length}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => mahnungVorbereiten(r)}
                      className="text-tanne-700 hover:underline text-xs font-medium"
                    >
                      Mahnung erstellen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ausgewaehlt && (
        <div className="fixed inset-0 bg-tanne-950/40 flex items-center justify-center p-4 z-20">
          <div className="bg-papier rounded-xl shadow-lg w-full max-w-lg p-6">
            <h2 className="font-display text-lg font-semibold text-tanne-900 mb-1">
              Mahnung für {ausgewaehlt.nummer}
            </h2>
            <p className="text-xs text-tanne-700/60 mb-4">{ausgewaehlt.customers?.name}</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-tanne-900 mb-1">Mahnstufe</label>
                <select
                  value={mahnstufe}
                  onChange={(e) => {
                    const stufe = Number(e.target.value);
                    setMahnstufe(stufe);
                    setMahntext(MAHNTEXTE[stufe]);
                  }}
                  className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm bg-white"
                >
                  <option value={1}>1. Mahnung (freundliche Erinnerung)</option>
                  <option value={2}>2. Mahnung</option>
                  <option value={3}>3. Mahnung (letzte Frist)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-tanne-900 mb-1">Mahngebühr (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={mahngebuehr}
                  onChange={(e) => setMahngebuehr(e.target.value)}
                  className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-tanne-900 mb-1">Mahntext</label>
                <textarea
                  value={mahntext}
                  onChange={(e) => setMahntext(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-tanne-900/15 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                onClick={() => setAusgewaehlt(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-tanne-900/70 hover:bg-tanne-900/5"
              >
                Abbrechen
              </button>
              <button
                onClick={mahnungSpeichernUndDrucken}
                className="rounded-lg bg-tanne-800 text-papier text-sm font-medium px-4 py-2 hover:bg-tanne-700"
              >
                Speichern & Drucken
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
