/**
 * lib/files.ts
 * Sube y baja archivos cifrados. Separado de api.ts porque esto no es JSON: es multipart
 * en la subida y bytes opacos en la descarga.
 *
 * El backend NUNCA ve el contenido del archivo ni su nombre/tipo reales — todo viaja
 * cifrado con la vaultKey del titular (ver lib/crypto.ts).
 *
 * TODO: esto carga el archivo completo en memoria (file.arrayBuffer()). Para archivos
 * grandes (videos de mensajes póstumos, por ejemplo) hace falta cifrado/subida en
 * streaming — ver mismo TODO en backend/app/services/storage_service.py.
 */
import { decryptBytes, encryptBytes } from "@/lib/crypto";
import type { VaultDocument, VaultDocumentMetadata } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // debe coincidir con MAX_UPLOAD_BYTES del backend

export async function uploadEncryptedFile(
  vaultKey: Uint8Array,
  vaultItemId: string,
  file: File
): Promise<VaultDocument> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Archivo excede el límite de ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB para este MVP.`);
  }

  const rawBytes = new Uint8Array(await file.arrayBuffer());
  const encryptedContent = await encryptBytes(vaultKey, rawBytes);

  const metadata: VaultDocumentMetadata = { filename: file.name, mime: file.type || "application/octet-stream" };
  const encryptedMetadataBlob = await encryptBytes(vaultKey, new TextEncoder().encode(JSON.stringify(metadata)));

  const form = new FormData();
  form.append("vault_item_id", vaultItemId);
  form.append("encrypted_metadata", encryptedMetadataBlob);
  // Subimos el blob cifrado (texto "<nonce_b64>:<ciphertext_b64>") como si fuera el archivo.
  form.append("file", new Blob([encryptedContent], { type: "text/plain" }), "encrypted.blob");

  const res = await fetch(`${API_URL}/documents`, {
    method: "POST",
    credentials: "include",
    body: form,
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {
      // sin body JSON
    }
    throw new Error(detail);
  }

  return res.json();
}

export async function downloadAndDecryptFile(
  vaultKey: Uint8Array,
  document: VaultDocument
): Promise<{ blob: Blob; metadata: VaultDocumentMetadata }> {
  const metadataBytes = await decryptBytes(vaultKey, document.encrypted_metadata);
  const metadata: VaultDocumentMetadata = JSON.parse(new TextDecoder().decode(metadataBytes));

  const res = await fetch(`${API_URL}/documents/${document.id}/download`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) throw new Error("No se pudo descargar el archivo.");

  const encryptedContent = await res.text();
  const rawBytes = await decryptBytes(vaultKey, encryptedContent);

  return { blob: new Blob([rawBytes], { type: metadata.mime }), metadata };
}

export async function deleteDocument(documentId: string): Promise<void> {
  const res = await fetch(`${API_URL}/documents/${documentId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok && res.status !== 204) throw new Error("No se pudo eliminar el documento.");
}
