// Einfacher, robuster CSV-Export ohne externe Abhängigkeit.
// Escaped Anführungszeichen/Kommas/Zeilenumbrüche korrekt für Excel & Co.

function feldEscapen(wert) {
  if (wert === null || wert === undefined) return '';
  const text = String(wert);
  if (/[",;\n]/.test(text)) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

/**
 * @param {string} dateiname z.B. "kunden-export.csv"
 * @param {string[]} spalten Überschriften, z.B. ["Name", "Ort", "E-Mail"]
 * @param {Array<Array<any>>} zeilen Datenzeilen in gleicher Spaltenreihenfolge
 */
export function csvExportieren(dateiname, spalten, zeilen) {
  const csvZeilen = [
    spalten.map(feldEscapen).join(';'),
    ...zeilen.map((zeile) => zeile.map(feldEscapen).join(';')),
  ];
  // BOM für korrekte Umlaute-Darstellung in Excel
  const inhalt = '\uFEFF' + csvZeilen.join('\r\n');
  const blob = new Blob([inhalt], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = dateiname;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
