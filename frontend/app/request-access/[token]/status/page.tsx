"use client";

import { useState, type FormEvent } from "react";

import { ErrorBanner } from "@/components/ErrorBanner";
import { decryptJSON, openSealed } from "@/lib/crypto";
import type { AccessRequest, AccessRequestStatus, VaultItemDetails } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const STATUS_LABELS: Record<AccessRequestStatus, string> = {
  PENDING: "Pendiente de revisión",
  APPROVED: "Aprobada",
  DENIED: "Denegada",
  EXPIRED: "Expirada",
};

interface ReleasePackage {
  released_at: string;
  vault_items: { type: string; title: string; details: VaultItemDetails }[];
  legacy_instructions: { title: string; body: string }[];
}

/**
 * Ruta pública: /request-access/[token]/status
 *
 * El contacto pega aquí la llave privada que guardó al crear su solicitud. Esa llave
 * NUNCA se envía al servidor: todo el descifrado ocurre en este navegador. Si el titular
 * aún no liberó nada, solo se muestra el estado de la solicitud.
 */
export default function RequestAccessStatusPage({ params }: { params: { token: string } }) {
  const [secretKey, setSecretKey] = useState("");
  const [request, setRequest] = useState<AccessRequest | null>(null);
  const [releasePackage, setReleasePackage] = useState<ReleasePackage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleCheck(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setReleasePackage(null);
    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/access-requests/lookup/${params.token}`);
      if (!res.ok) throw new Error("No se pudo consultar el estado.");
      const requests: AccessRequest[] = await res.json();

      if (requests.length === 0) {
        throw new Error("No encontramos solicitudes para este link.");
      }

      // Toma la más reciente (ya vienen ordenadas desc por created_at desde el backend).
      const latest = requests[0];
      setRequest(latest);

      if (latest.sealed_release_key && latest.encrypted_release_payload) {
        const releaseKey = await openSealed(secretKey.trim(), latest.sealed_release_key);
        const pkg = await decryptJSON<ReleasePackage>(releaseKey, latest.encrypted_release_payload);
        setReleasePackage(pkg);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold">Estado de tu solicitud</h1>
        <p className="mt-2 text-sm text-ink/60">
          Pega la llave que guardaste al crear tu solicitud. Se usa solo en este navegador
          para abrir lo que el titular haya liberado — nunca se envía a ningún servidor.
        </p>
      </div>

      <form onSubmit={handleCheck} className="flex flex-col gap-4">
        <textarea
          required
          rows={2}
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
          placeholder="Pega aquí tu llave privada"
          className="rounded-md border border-ink/20 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
        <ErrorBanner message={error} />
        <button
          type="submit"
          disabled={isLoading}
          className="self-start rounded-md bg-accent px-4 py-2 text-sm font-medium text-paper hover:opacity-90 disabled:opacity-50"
        >
          {isLoading ? "Verificando…" : "Ver estado"}
        </button>
      </form>

      {request && !releasePackage && (
        <div className="rounded-md border border-ink/10 bg-white p-4 text-sm">
          <p>
            Estado actual: <strong>{STATUS_LABELS[request.status]}</strong>
          </p>
          {request.status === "APPROVED" && (
            <p className="mt-1 text-ink/60">
              El titular aprobó tu solicitud pero todavía no libera el contenido. Vuelve a
              revisar más tarde.
            </p>
          )}
        </div>
      )}

      {releasePackage && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink/60">
            Liberado el {new Date(releasePackage.released_at).toLocaleString("es-MX")}.
          </p>

          {releasePackage.vault_items.length > 0 && (
            <div>
              <p className="text-sm font-medium">Inventario</p>
              <div className="mt-2 flex flex-col gap-2">
                {releasePackage.vault_items.map((item, idx) => (
                  <div key={idx} className="rounded-md border border-ink/10 bg-white p-3 text-sm">
                    <p className="font-medium">
                      {item.title} <span className="text-xs text-ink/40">({item.type})</span>
                    </p>
                    <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-ink/70">
                      {Object.entries(item.details).map(
                        ([key, value]) =>
                          Boolean(value) && (
                            <div key={key} className="contents">
                              <dt className="text-ink/40">{key}</dt>
                              <dd>{String(value)}</dd>
                            </div>
                          )
                      )}
                    </dl>
                  </div>
                ))}
              </div>
            </div>
          )}

          {releasePackage.legacy_instructions.length > 0 && (
            <div>
              <p className="text-sm font-medium">Instrucciones</p>
              <div className="mt-2 flex flex-col gap-2">
                {releasePackage.legacy_instructions.map((instruction, idx) => (
                  <div key={idx} className="rounded-md border border-ink/10 bg-white p-3 text-sm">
                    <p className="font-medium">{instruction.title}</p>
                    <p className="mt-1 text-ink/70">{instruction.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
