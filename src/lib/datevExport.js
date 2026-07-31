import { csvExportieren } from './csvExport';

// Vereinfachter Buchhaltungsexport. Das offizielle DATEV-Format
// ("Buchungsstapel") verlangt eine exakte Kopfzeilenstruktur mit
// Versions-/Berater-/Mandantennummer und eine bestimmte Zeichenkodierung.
// Diese Funktion erzeugt stattdessen eine gut lesbare, aber inhaltlich
// entsprechende CSV, die ein Steuerberater direkt weiterverarbeiten oder
// bei Bedarf ins offizielle Format überführen kann.
export function datevExportErzeugen(rechnungen, summenProRechnung) {
  csvExportieren(
    'buchhaltungsexport.csv',
    [
      'Belegnummer',
      'Belegdatum',
      'Kunde',
      'Nettobetrag',
      'USt-Betrag',
      'Bruttobetrag',
      'Buchungstext',
    ],
    rechnungen
      .filter((r) => r.status === 'freigegeben' || r.status === 'bezahlt')
      .map((r) => {
        const summe = summenProRechnung[r.id] || { netto: 0, brutto: 0 };
        return [
          r.nummer,
          r.rechnungsdatum ? new Date(r.rechnungsdatum).toLocaleDateString('de-DE') : '',
          r.customers?.name || '',
          summe.netto.toFixed(2),
          (summe.brutto - summe.netto).toFixed(2),
          summe.brutto.toFixed(2),
          `Rechnung ${r.nummer} – ${r.customers?.name || ''}`,
        ];
      })
  );
}
