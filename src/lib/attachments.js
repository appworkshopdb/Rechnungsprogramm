import { supabase } from './supabaseClient';

const BUCKET = 'anhaenge';

export async function anhaengeLaden(entityType, entityId) {
  const { data, error } = await supabase
    .from('attachments')
    .select('*, profiles(full_name)')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function anhangHochladen(entityType, entityId, file, hochgeladenVon) {
  // Eindeutiger Pfad, damit sich gleichnamige Dateien nicht überschreiben
  const eindeutigerName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const pfad = `${entityType}/${entityId}/${eindeutigerName}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(pfad, file);
  if (uploadError) throw uploadError;

  const { error: dbError } = await supabase.from('attachments').insert({
    entity_type: entityType,
    entity_id: entityId,
    dateiname: file.name,
    storage_path: pfad,
    groesse_bytes: file.size,
    mime_type: file.type,
    hochgeladen_von: hochgeladenVon,
  });
  if (dbError) throw dbError;
}

export async function anhangHerunterladen(storagePath) {
  // Bucket ist privat -> zeitlich begrenzte, signierte URL erzeugen
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60); // 60 Sekunden gültig
  if (error) throw error;
  window.open(data.signedUrl, '_blank');
}

export async function anhangLoeschen(id, storagePath) {
  await supabase.storage.from(BUCKET).remove([storagePath]);
  const { error } = await supabase.from('attachments').delete().eq('id', id);
  if (error) throw error;
}

export function dateigroesseFormatieren(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
