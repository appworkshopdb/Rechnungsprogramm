// Erzeugt eine XRechnung-konforme XML-Datei (UBL 2.1 Invoice-Syntax) aus
// den Rechnungsdaten. Deckt die EN16931-Kernfelder ab sowie
// forstspezifische Besonderheiten (Durchschnittssatzbesteuerung nach
// § 24 UStG, genormte Mengeneinheiten, Self-Billing/Gutschrift, Skonto).
//
// WICHTIG: Dies ist eine sorgfältige, aber nicht offiziell zertifizierte
// Implementierung. Vor dem produktiven Versand jede Datei mit dem
// KoSIT-Validator prüfen und die steuerliche Behandlung (v.a. die Sätze
// 5,5 % / 7,8 % und die Kategorie-Codes) mit dem Steuerberater abstimmen.

function escapeXml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Interne Einheit -> genormter Code nach UN/ECE Recommendation 20.
// Quelle: Anforderungsdokument E-Rechnung (Forstwirtschaft).
const EINHEIT_CODE = {
  stunde: 'HUR',
  tag: 'DAY',
  festmeter: 'M3Q', // Festmeter/Raummeter/Kubikmeter -> M3Q
  raummeter: 'M3Q',
  kubikmeter: 'M3Q',
  hektar: 'HAR',
  kilogramm: 'KGM',
  tonne: 'TNE',
  km: 'KMT',
  pauschale: 'C62',
  stueck: 'C62',
  frei: 'C62',
};

// Steuersatz -> UStG-/EN16931-Kategorie-Code + gesetzlicher Hinweistext (BT-120).
// - 5,5 %  Forstwirtschaftliche Erzeugnisse (Durchschnittssatz § 24 UStG)
// - 7,8 %  Selbstständige forstliche Dienstleistungen (Durchschnittssatz § 24 UStG)
// - 19 %/7 % Regelbesteuerung
// - 0 %    steuerfrei
// Für die Durchschnittssatzbesteuerung wird Kategorie-Code "AA" (ermäßigt)
// verwendet, sonst "S" (Standard) bzw. "Z" (Nullsatz).
function steuerKategorie(satz) {
  const s = Number(satz);
  if (s === 5.5) {
    return {
      code: 'AA',
      hinweis: 'Durchschnittssatzbesteuerung § 24 UStG (forstwirtschaftliche Erzeugnisse)',
    };
  }
  if (s === 7.8) {
    return {
      code: 'AA',
      hinweis: 'Durchschnittssatzbesteuerung § 24 UStG (forstliche Dienstleistung)',
    };
  }
  if (s === 0) {
    return { code: 'Z', hinweis: 'Steuerfreie Leistung' };
  }
  return { code: 'S', hinweis: '' };
}

function summenBerechnen(items) {
  const netto = items.reduce((s, p) => s + Number(p.menge) * Number(p.einzelpreis), 0);
  const ustGruppen = {};
  items.forEach((p) => {
    const satz = Number(p.ust_satz);
    const zeilenNetto = Number(p.menge) * Number(p.einzelpreis);
    if (!ustGruppen[satz]) ustGruppen[satz] = 0;
    ustGruppen[satz] += zeilenNetto * (satz / 100);
  });
  const ustGesamt = Object.values(ustGruppen).reduce((a, b) => a + b, 0);
  return { netto, ustGruppen, ustGesamt, brutto: netto + ustGesamt };
}

/**
 * @param {object} invoice   Zeile aus `invoices` (nummer, rechnungsdatum, skonto…)
 * @param {object[]} items   Zeilen aus `invoice_items`
 * @param {object} customer  Zeile aus `customers`
 * @param {object} company   Zeile aus `company_settings`
 * @param {object} [optionen]
 * @param {boolean} [optionen.selfBilling]  true = Gutschrift (Self-Billing, Code 389)
 * @returns {string} XML-Dokument als String
 */
export function xrechnungXmlErzeugen(invoice, items, customer, company, optionen = {}) {
  const selfBilling = optionen.selfBilling === true;
  const summen = summenBerechnen(items);
  const waehrung = 'EUR';
  const datum = invoice.rechnungsdatum || new Date().toISOString().slice(0, 10);

  // BT-3: 380 = normale Rechnung, 389 = Self-billed invoice (Gutschrift Holzverkauf)
  const invoiceTypeCode = selfBilling ? '389' : '380';

  // BT-10 Käuferreferenz: bei öffentlichen Auftraggebern die Leitweg-ID,
  // sonst der Kundenname. Nie leer lassen (sonst Validierungsfehler) —
  // Platzhalter "-", falls nichts vorhanden.
  const buyerReference =
    (customer.kundentyp === 'oeffentlich' && customer.leitweg_id
      ? customer.leitweg_id
      : customer.name) || '-';

  // Steueraufschlüsselung je Satz inkl. Kategorie-Code + BT-120-Hinweis
  const taxSubtotals = Object.entries(summen.ustGruppen)
    .map(([satz, betrag]) => {
      const kat = steuerKategorie(satz);
      const zeilenNettoFuerSatz = items
        .filter((p) => Number(p.ust_satz) === Number(satz))
        .reduce((s, p) => s + Number(p.menge) * Number(p.einzelpreis), 0);
      const hinweisZeile = kat.hinweis
        ? `\n        <cbc:TaxExemptionReason>${escapeXml(kat.hinweis)}</cbc:TaxExemptionReason>`
        : '';
      return `
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${waehrung}">${zeilenNettoFuerSatz.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${waehrung}">${betrag.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${kat.code}</cbc:ID>
        <cbc:Percent>${Number(satz).toFixed(2)}</cbc:Percent>${hinweisZeile}
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`;
    })
    .join('');

  const invoiceLines = items
    .map((p, idx) => {
      const zeilenNetto = Number(p.menge) * Number(p.einzelpreis);
      const code = EINHEIT_CODE[p.einheit] || 'C62';
      const kat = steuerKategorie(p.ust_satz);
      return `
  <cac:InvoiceLine>
    <cbc:ID>${idx + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${code}">${Number(p.menge).toFixed(2)}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${waehrung}">${zeilenNetto.toFixed(2)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>${escapeXml(p.bezeichnung)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>${kat.code}</cbc:ID>
        <cbc:Percent>${Number(p.ust_satz).toFixed(2)}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${waehrung}">${Number(p.einzelpreis).toFixed(2)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`;
    })
    .join('');

  // Zahlungsbedingungen / Skonto (BT-20) im vordefinierten Segmentformat,
  // nur wenn Skonto-Angaben vorhanden sind.
  let paymentTerms = '';
  if (invoice.skonto_tage && invoice.skonto_prozent) {
    const skontoText = `#SKONTO:TAGE=${invoice.skonto_tage};PROZENT=${Number(
      invoice.skonto_prozent
    ).toFixed(2)}#`;
    paymentTerms = `
  <cac:PaymentTerms>
    <cbc:Note>${escapeXml(skontoText)}</cbc:Note>
  </cac:PaymentTerms>`;
  }

  // Bei Gutschrift (Self-Billing) zusätzlicher rechtlicher Hinweis "Gutschrift"
  const gutschriftNote = selfBilling
    ? `\n  <cbc:Note>Gutschrift</cbc:Note>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_2.3</cbc:CustomizationID>
  <cbc:ID>${escapeXml(invoice.nummer)}</cbc:ID>
  <cbc:IssueDate>${datum}</cbc:IssueDate>
  <cbc:InvoiceTypeCode>${invoiceTypeCode}</cbc:InvoiceTypeCode>${gutschriftNote}
  <cbc:DocumentCurrencyCode>${waehrung}</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>${escapeXml(buyerReference)}</cbc:BuyerReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(company.strasse)}</cbc:StreetName>
        <cbc:CityName>${escapeXml(company.ort)}</cbc:CityName>
        <cbc:PostalZone>${escapeXml(company.plz)}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(company.ust_idnr)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(company.firmenname)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
      <cac:Contact>
        <cbc:Telephone>${escapeXml(company.telefon)}</cbc:Telephone>
        <cbc:ElectronicMail>${escapeXml(company.email)}</cbc:ElectronicMail>
      </cac:Contact>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(customer.strasse)}</cbc:StreetName>
        <cbc:CityName>${escapeXml(customer.ort)}</cbc:CityName>
        <cbc:PostalZone>${escapeXml(customer.plz)}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(customer.name)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>
    <cac:PayeeFinancialAccount>
      <cbc:ID>${escapeXml(company.iban)}</cbc:ID>
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>${paymentTerms}
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${waehrung}">${summen.ustGesamt.toFixed(2)}</cbc:TaxAmount>${taxSubtotals}
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${waehrung}">${summen.netto.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${waehrung}">${summen.netto.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${waehrung}">${summen.brutto.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${waehrung}">${summen.brutto.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>${invoiceLines}
</Invoice>
`;
}

export function xmlHerunterladen(dateiname, xmlString) {
  const blob = new Blob([xmlString], { type: 'application/xml;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = dateiname;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
