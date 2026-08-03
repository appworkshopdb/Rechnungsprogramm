// Zentrale Liste der Mengeneinheiten. Der Code ist der genormte
// UN/ECE-Rec-20-Code, der in der E-Rechnung (XRechnung) verwendet wird.
// Wird in ServicesPage, InvoiceEditor, CreditNoteEditor, DeliveryNoteEditor
// und TemplatesPage genutzt, damit überall dieselben Einheiten erscheinen.

export const EINHEITEN = [
  { value: 'stunde', label: 'Stunde', code: 'HUR' },
  { value: 'tag', label: 'Tag', code: 'DAY' },
  { value: 'festmeter', label: 'Festmeter (fm)', code: 'MTQ' },
  { value: 'raummeter', label: 'Raummeter (rm)', code: 'MTQ' },
  { value: 'kubikmeter', label: 'Kubikmeter (m³)', code: 'MTQ' },
  { value: 'hektar', label: 'Hektar (ha)', code: 'HAR' },
  { value: 'kilogramm', label: 'Kilogramm (kg)', code: 'KGM' },
  { value: 'tonne', label: 'Tonne (t)', code: 'TNE' },
  { value: 'km', label: 'Kilometer', code: 'KMT' },
  { value: 'stueck', label: 'Stück', code: 'C62' },
  { value: 'pauschale', label: 'Pauschale', code: 'C62' },
  { value: 'frei', label: 'Frei (individuell)', code: 'C62' },
];

export function einheitLabel(value) {
  return EINHEITEN.find((e) => e.value === value)?.label || value;
}

// Häufige USt-Sätze für die Forstwirtschaft (als Vorschläge/Schnellauswahl).
// Der Satz bleibt frei eingebbar; diese Liste dient nur der bequemen Auswahl.
export const UST_SAETZE = [
  { value: 5.5, label: '5,5 % — Forsterzeugnis (§24)' },
  { value: 7.8, label: '7,8 % — Forstdienstleistung (§24)' },
  { value: 7, label: '7 % — ermäßigt' },
  { value: 19, label: '19 % — Regelbesteuerung' },
  { value: 0, label: '0 % — steuerfrei' },
];
