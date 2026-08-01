// Edge Function: mirror-to-drive
// -----------------------------------------------------------------------
// Nimmt eine Datei (als Base64) entgegen und lädt sie zusätzlich in den
// passenden Google-Drive-Ordner hoch, über ein Google-Service-Konto.
// Läuft NACH dem eigentlichen Supabase-Storage-Upload — schlägt diese
// Funktion fehl, bleibt die Datei trotzdem in der App gespeichert.
//
// Benötigte Secrets (Project Settings -> Edge Functions -> Secrets):
//   GOOGLE_CLIENT_EMAIL          z.B. forstservice-uploader@...iam.gserviceaccount.com
//   GOOGLE_PRIVATE_KEY           kompletter private_key-Wert aus der JSON-Datei
//                                (inkl. -----BEGIN/END PRIVATE KEY-----, \n bleiben als \n)
//   GDRIVE_FOLDER_CUSTOMER       Ordner-ID für Kunden-Anhänge
//   GDRIVE_FOLDER_INVOICE        Ordner-ID für Rechnungs-Anhänge
//   GDRIVE_FOLDER_DELIVERY_NOTE  Ordner-ID für Lieferschein-Anhänge
// -----------------------------------------------------------------------

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ORDNER_IDS: Record<string, string | undefined> = {
  customer: Deno.env.get('GDRIVE_FOLDER_CUSTOMER'),
  invoice: Deno.env.get('GDRIVE_FOLDER_INVOICE'),
  delivery_note: Deno.env.get('GDRIVE_FOLDER_DELIVERY_NOTE'),
};

function base64UrlEncode(input: ArrayBuffer | string): string {
  let bytes: Uint8Array;
  if (typeof input === 'string') {
    bytes = new TextEncoder().encode(input);
  } else {
    bytes = new Uint8Array(input);
  }
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function googleAccessToken(): Promise<string> {
  const clientEmail = Deno.env.get('GOOGLE_CLIENT_EMAIL');
  const privateKeyRaw = Deno.env.get('GOOGLE_PRIVATE_KEY');
  if (!clientEmail || !privateKeyRaw) {
    throw new Error('GOOGLE_CLIENT_EMAIL oder GOOGLE_PRIVATE_KEY fehlt als Secret.');
  }
  const privateKeyPem = privateKeyRaw.replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(
    JSON.stringify(claimSet)
  )}`;

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );
  const jwt = `${signingInput}.${base64UrlEncode(signature)}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Google-Token-Fehler: ${await tokenResponse.text()}`);
  }
  const tokenJson = await tokenResponse.json();
  return tokenJson.access_token as string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { entityType, dateiname, mimeType, inhaltBase64 } = await req.json();

    const folderId = ORDNER_IDS[entityType];
    if (!folderId) {
      throw new Error(`Kein Google-Drive-Ordner für Typ "${entityType}" konfiguriert.`);
    }
    if (!dateiname || !inhaltBase64) {
      throw new Error('Dateiname oder Inhalt fehlt.');
    }

    const accessToken = await googleAccessToken();

    const boundary = 'forstservice_boundary_' + crypto.randomUUID();
    const metadata = JSON.stringify({ name: dateiname, parents: [folderId] });

    const body =
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      `${metadata}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${mimeType || 'application/octet-stream'}\r\n` +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      `${inhaltBase64}\r\n` +
      `--${boundary}--`;

    const uploadResponse = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );

    if (!uploadResponse.ok) {
      throw new Error(`Google-Drive-Upload-Fehler: ${await uploadResponse.text()}`);
    }

    const uploadJson = await uploadResponse.json();

    return new Response(JSON.stringify({ ok: true, driveFileId: uploadJson.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
