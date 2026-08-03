import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const STATUS_LABEL = {
  entwurf: { text: 'Entwurf', klasse: 'bg-tanne-900/10 text-tanne-900/70' },
  abgeschlossen: { text: 'Abgeschlossen', klasse: 'bg-moos/25 text-tanne-800' },
};

export default function DeliveryNotesPage() {
  const [lieferscheine, setLieferscheine] = useState([]);
  const [ladeVorgang, setLadeVorgang] = useState(true);

  async function laden() {
    setLadeVorgang(true);
    const { data, error } = await supabase
      .from('delivery_notes')
      .select('id, nummer, status, lieferdatum, created_at, customers(name)')
      .order('created_at', { ascending: false });
    if (!error) setLieferscheine(data);
    setLadeVorgang(false);
  }

  useEffect(() => {
    laden();
  }, []);

  // Entwürfe links, abgeschlossene rechts — jeweils neueste zuerst.
  const entwuerfe = lieferscheine.filter((l) => l.status === 'entwurf');
  const abgeschlossene = lieferscheine.filter((l) => l.status !== 'entwurf');

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-tanne-900">Lieferscheine</h1>
          <p className="text-sm text-tanne-700/70">Lieferungen und Leistungsnachweise</p>
        </div>
        <Link
          to="/lieferscheine/neu"
          className="rounded-lg bg-tanne-800 text-papier text-sm font-medium px-4 py-2 hover:bg-tanne-700 transition-colors"
        >
          + Neuer Lieferschein
        </Link>
      </div>

      {ladeVorgang ? (
        <p className="text-sm text-tanne-700/60">Lade Lieferscheine…</p>
      ) : lieferscheine.length === 0 ? (
        <div className="rounded-xl border border-dashed border-tanne-900/20 p-8 text-center text-tanne-700/60">
          Noch keine Lieferscheine vorhanden.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SpalteLieferscheine titel="Entwürfe" eintraege={entwuerfe} leerText="Keine Entwürfe." />
          <SpalteLieferscheine
            titel="Abgeschlossen"
            eintraege={abgeschlossene}
            leerText="Noch keine abgeschlossenen Lieferscheine."
          />
        </div>
      )}
    </div>
  );
}

function SpalteLieferscheine({ titel, eintraege, leerText }) {
  return (
    <div>
      <h2 className="text-xs font-semibold text-tanne-700 uppercase tracking-wide mb-2">
        {titel} <span className="text-tanne-700/50">({eintraege.length})</span>
      </h2>
      {eintraege.length === 0 ? (
        <div className="rounded-xl border border-dashed border-tanne-900/15 p-6 text-center text-sm text-tanne-700/50">
          {leerText}
        </div>
      ) : (
        <div className="space-y-2">
          {eintraege.map((l) => (
            <div
              key={l.id}
              className="rounded-xl border border-tanne-900/10 bg-white/60 px-4 py-3 hover:bg-tanne-900/[0.03]"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-tanne-900 truncate">{l.customers?.name || '–'}</p>
                  <p className="text-xs text-tanne-700/60 font-mono mt-0.5">
                    {l.nummer || '— Entwurf —'}
                    {l.lieferdatum && (
                      <span className="ml-2">
                        {new Date(l.lieferdatum).toLocaleDateString('de-DE')}
                      </span>
                    )}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_LABEL[l.status].klasse}`}
                >
                  {STATUS_LABEL[l.status].text}
                </span>
              </div>
              <div className="flex items-center justify-end mt-2">
                <Link
                  to={`/lieferscheine/${l.id}`}
                  className="text-tanne-700 hover:underline text-xs font-medium"
                >
                  {l.status === 'entwurf' ? 'Bearbeiten' : 'Ansehen'}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
