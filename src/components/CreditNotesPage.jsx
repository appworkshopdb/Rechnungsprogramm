import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const STATUS_LABEL = {
  entwurf: { text: 'Entwurf', klasse: 'bg-tanne-900/10 text-tanne-900/70' },
  freigegeben: { text: 'Freigegeben', klasse: 'bg-moos/25 text-tanne-800' },
  bezahlt: { text: 'Erstattet', klasse: 'bg-tanne-700/20 text-tanne-800' },
  storniert: { text: 'Storniert', klasse: 'bg-rost/15 text-rost' },
};

export default function CreditNotesPage() {
  const [gutschriften, setGutschriften] = useState([]);
  const [ladeVorgang, setLadeVorgang] = useState(true);

  async function laden() {
    setLadeVorgang(true);
    const { data, error } = await supabase
      .from('credit_notes')
      .select('id, nummer, status, gutschriftdatum, created_at, customers(name)')
      .order('created_at', { ascending: false });
    if (!error) setGutschriften(data);
    setLadeVorgang(false);
  }

  useEffect(() => {
    laden();
  }, []);

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-tanne-900">Gutschriften</h1>
          <p className="text-sm text-tanne-700/70">Korrekturen zu bereits gestellten Rechnungen</p>
        </div>
        <Link
          to="/gutschriften/neu"
          className="rounded-lg bg-tanne-800 text-papier text-sm font-medium px-4 py-2 hover:bg-tanne-700 transition-colors"
        >
          + Neue Gutschrift
        </Link>
      </div>

      {ladeVorgang ? (
        <p className="text-sm text-tanne-700/60">Lade Gutschriften…</p>
      ) : gutschriften.length === 0 ? (
        <div className="rounded-xl border border-dashed border-tanne-900/20 p-8 text-center text-tanne-700/60">
          Noch keine Gutschriften vorhanden.
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
              {gutschriften.map((g) => (
                <tr key={g.id} className="border-t border-tanne-900/5 hover:bg-tanne-900/[0.03]">
                  <td className="px-4 py-3 font-mono text-xs text-tanne-900">
                    {g.nummer || <span className="text-tanne-700/40">— Entwurf —</span>}
                  </td>
                  <td className="px-4 py-3 text-tanne-900/90">{g.customers?.name || '–'}</td>
                  <td className="px-4 py-3 text-tanne-900/80">
                    {g.gutschriftdatum ? new Date(g.gutschriftdatum).toLocaleDateString('de-DE') : '–'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_LABEL[g.status].klasse}`}
                    >
                      {STATUS_LABEL[g.status].text}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/gutschriften/${g.id}`}
                      className="text-tanne-700 hover:underline text-xs font-medium"
                    >
                      {g.status === 'entwurf' ? 'Bearbeiten' : 'Ansehen'}
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
