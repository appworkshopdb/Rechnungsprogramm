// Zentrale Liste der Leistungs-Kategorien für den Forstbetrieb.
// Wird sowohl in der Leistungsverwaltung als auch im Rechnungs-Editor
// genutzt, damit die Kategorien überall identisch sind.

export const KATEGORIEN = [
  'Waldbewirtschaftung',
  'Baumarbeiten (Arboristik)',
  'Holzverarbeitung & Vermarktung',
  'Maschinenarbeiten',
  'Beratung & Planung',
  'Landschaftspflege & Sonstiges',
  'Anfahrt & Transport',
  'Zeitbasierte Kosten',
  'Material & Verbrauch',
  'Entsorgung & Abtransport',
  'Genehmigungen & Absicherung',
  'Zuschläge',
  'Sonstige Positionen',
];

// Fallback-Bezeichnung für Leistungen ohne zugewiesene Kategorie
export const OHNE_KATEGORIE = 'Ohne Kategorie';
