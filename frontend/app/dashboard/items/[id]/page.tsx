"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { ErrorBanner } from "@/components/ErrorBanner";
import { useVault } from "@/hooks/useVault";
import { api, ApiError } from "@/lib/api";
import { deleteDocument, downloadAndDecryptFile, uploadEncryptedFile } from "@/lib/files";
import type { VaultDocument, VaultDocumentMetadata, VaultItem, VaultItemDetails } from "@/lib/types";

interface DecryptedDocument {
  document: VaultDocument;
  metadata: VaultDocumentMetadata | null;
}

export default function VaultItemDetailPage({ params }: { params: { id: string } }) {
  const { vaultKey, decrypt } = useVault();

  const [item, setItem] = useState<VaultItem | null>(null);
  const [details, setDetails] = useState<VaultItemDetails | null>(null);
  const [documents, setDocuments] = useState<DecryptedDocument[] | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [busyDocId, setBusyDocId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadDocuments() {
    const docs = await api.get<VaultDocument[]>(`/documents/by-item/${params.id}`);
    const decrypted = await Promise.all(
      docs.map(async (document) => {
        try {
          const metadata = await decrypt<VaultDocumentMetadata>(document.encrypted_metadata);
          return { document, metadata };
        } catch {
          return { document, metadata: null };
        }
      })
    );
    setDocuments(decrypted);
  }

  async function loadAll() {
    try {
      const fetchedItem = await api.get<VaultItem>(`/vault-items/${params.id}`);
      setItem(fetchedItem);
      const decryptedDetails = await decrypt<VaultItemDetails>(fetchedItem.encrypted_payload);
      setDetails(decryptedDetails);
      await loadDocuments();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar el ítem.");
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !vaultKey) return;

    setIsUploading(true);
    setError(null);
    try {
      await uploadEncryptedFile(vaultKey, params.id, file);
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir el documento.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDownload(document: VaultDocument) {
    if (!vaultKey) return;
    setBusyDocId(document.id);
    setError(null);
    try {
      const { blob, metadata } = await downloadAndDecryptFile(vaultKey, document);
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = metadata.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo descargar el archivo.");
    } finally {
      setBusyDocId(null);
    }
  }

  async function handleDelete(documentId: string) {
    setBusyDocId(documentId);
    setError(null);
    try {
      await deleteDocument(documentId);
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el documento.");
    } finally {
      setBusyDocId(null);
    }
  }

  if (!item) {
    return <p className="text-sm text-ink/50">{error ?? "Cargando…"}</p>;
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{item.title}</h1>
        <p className="mt-1 text-sm text-ink/60">{item.type}</p>
      </div>

      {details && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-ink/10 bg-white p-4 text-sm">
          {Object.entries(details).map(
            ([key, value]) =>
              Boolean(value) && (
                <div key={key} className="contents">
                  <dt className="text-ink/40">{key}</dt>
                  <dd>{String(value)}</dd>
                </div>
              )
          )}
        </dl>
      )}

      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-ink">Documentos</p>
          <label className="cursor-pointer rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-paper hover:opacity-90">
            {isUploading ? "Cifrando y subiendo…" : "+ Subir archivo"}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              disabled={isUploading}
              onChange={handleFileChange}
            />
          </label>
        </div>
        <p className="mt-1 text-xs text-ink/40">
          El archivo se cifra en tu navegador antes de subirse. Límite 25MB en este MVP.
        </p>

        <ErrorBanner message={error} />

        <div className="mt-3 flex flex-col gap-2">
          {documents?.map(({ document, metadata }) => (
            <div
              key={document.id}
              className="flex items-center justify-between rounded-md border border-ink/10 bg-white px-3 py-2"
            >
              <div>
                <p className="text-sm">{metadata?.filename ?? "(no se pudo descifrar el nombre)"}</p>
                <p className="text-xs text-ink/40">{(document.size_bytes / 1024).toFixed(0)} KB</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDownload(document)}
                  disabled={busyDocId === document.id}
                  className="text-xs font-medium text-accent hover:underline disabled:opacity-50"
                >
                  Descargar
                </button>
                <button
                  onClick={() => handleDelete(document.id)}
                  disabled={busyDocId === document.id}
                  className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
          {documents?.length === 0 && <p className="text-xs text-ink/40">Sin documentos todavía.</p>}
        </div>
      </div>
    </div>
  );
}
