import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import {
  anhaengeLaden,
  anhangHochladen,
  anhangHerunterladen,
  anhangLoeschen,
  dateigroesseFormatieren,
} from '../lib/attachments';

/**
 * @param {string} entityType 'customer' | 'invoice' | 'delivery_note'
 * @param {string} entityId   UUID des zugehörigen Datensatzes
 */
export default function AttachmentsPanel({ entityType, entityId }) {
  const { profile, istAdminOderBuchhaltung } = useAuth();
  const [anhaenge, setAnhaenge] = useState([]);
  const [ladeVorgang, setLadeVorgang] = useState(true);
  const [laedtHoch, setLaedtHoch] = useState(false);
  const [fehler, setFehler] = useState(null);
  const fileInputRef = useRef(null);

  async function laden() {
    if (!entityId) return;
    setLadeVorgang(true);
    try {
      const daten = await anhaengeLaden(entityType, entityId);
      setAnhaenge(daten);
    } catch (e) {
      setFehler('Anhänge konnten nicht geladen werden: ' + e.message);
    }
    setLadeVorgang(false);
  }

  useEffect(() => {
    laden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  async function dateiAusgewaehlt(e) {
    const dateien = Array.from(e.target.files || []);
    if (dateien.length === 0) return;
    setFehler(null);
    setLaedtHoch(true);
    try {
      for (const datei of dateien) {
        // 10 MB Grenze pro Datei — schont das 1 GB-Kontingent im Supabase-Free-Tier
        if (datei.size > 10 * 1024 * 1024) {
          setFehler(`"${datei.name}" ist größer als 10 MB und wurde übersprungen.`);
          continue;
        }
        await anhangHochladen(entityType, entityId, datei, profile?.id);
      }
      await laden();
    } catch (err) {
      setFehler('Hochladen fehlgeschlagen: ' + err.message);
    }
    setLaedtHoch(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function herunterladen(pfad) {
    try {
      await anhangHerunterladen(pfad);
    } catch (err) {
      setFehler('Download fehlgeschlagen: ' + err.message);
    }
  }

  async function loeschen(id, pfad) {
    if (!confirm('Diesen Anhang wirklich löschen?')) return;
    try {
      await anhangLoeschen(id, pfad);
      laden();
    } catch (err) {
      setFehler('Löschen fehlgeschlagen: ' + err.message);
    }
  }

  if (!entityId) {
    return (
      <p className="text-xs text-tanne-700/50 italic">
        Erst speichern, danach können Anhänge hochgeladen werden.
      </p>
    );
  }

  return (
    <div className="no-print">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-tanne-900 uppercase tracking-wide">Anhänge</p>
        <label className="text-xs font-medium text-tanne-700 hover:underline cursor-pointer">
          {laedtHoch ? 'Lädt hoch…' : '+ Datei hochladen'}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={dateiAusgewaehlt}
            disabled={laedtHoch}
            className="hidden"
          />
        </label>
      </div>

      {fehler && <p className="text-xs text-rost mb-2">{fehler}</p>}

      {ladeVorgang ? (
        <p className="text-xs text-tanne-700/50">Lade…</p>
      ) : anhaenge.length === 0 ? (
        <p className="text-xs text-tanne-700/50">Noch keine Anhänge.</p>
      ) : (
        <ul className="space-y-1.5">
          {anhaenge.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between text-sm bg-white/60 border border-tanne-900/10 rounded-lg px-3 py-2"
            >
              <button
                onClick={() => herunterladen(a.storage_path)}
                className="text-left text-tanne-900 hover:underline truncate mr-2"
                title={a.dateiname}
              >
                📎 {a.dateiname}
              </button>
              <div className="flex items-center gap-2 shrink-0 text-xs text-tanne-700/50">
                <span>{dateigroesseFormatieren(a.groesse_bytes)}</span>
                {istAdminOderBuchhaltung && (
                  <button
                    onClick={() => loeschen(a.id, a.storage_path)}
                    className="text-rost hover:underline"
                  >
                    Löschen
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
