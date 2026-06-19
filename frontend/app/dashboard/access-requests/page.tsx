"use client";

import { useEffect, useState } from "react";

import { ErrorBanner } from "@/components/ErrorBanner";
import { useVault } from "@/hooks/useVault";
import { api, ApiError } from "@/lib/api";
import { encryptJSON, generateVaultKey, sealForRecipient } from "@/lib/crypto";
import type { AccessRequest, AccessRequestStatus, Contact, LegacyInstruction, VaultItem, VaultItemDetails } from "@/lib/types";

const STATUS_LABELS: Record<AccessRequestStatus, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  DENIED: "Denegada",
  EXPIRED: "Expirada",
};

const STATUS_STYLES: Record<AccessRequestStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  DENIED: "bg-red-100 text-red-700",
  EXPIRED: "bg-ink/10 text-ink/50",
};

/** Forma del paquete que arma el titular y que el contacto eventualmente descifra. */
interface ReleasePackage {
  released_at: string;
  vault_items: { type: string; title: string; details: VaultItemDetails }[];
  legacy_instructions: { title: string; body: string }[];
}

export default function AccessRequestsPage() {
  const { decrypt, isUnlocked } = useVault();

  const [requests, setRequests] = useState<AccessRequest[] | null>(null);
  const [contactsById, setContactsById] = useState<Record<string, Contact>>({});
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [releasingId, setReleasingId] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [requestList, contactList] = await Promise.all([
        api.get<AccessRequest[]>("/access-requests"),
        api.get<Contact[]>("/contacts"),
      ]);
      setRequests(requestList);
      setContactsById(Object.fromEntries(contactList.map((c) => [c.id, c])));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar las solicitudes.");
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function reviewRequest(id: string, status: "APPROVED" | "DENIED") {
    setUpdatingId(id);
    setError(null);
    try {
      await api.patch<AccessRequest>(`/access-requests/${id}`, { status });
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar la solicitud.");
    } finally {
      setUpdatingId(null);
    }
  }

  /**
   * El paso que realmente resuelve el problema de zero-knowledge: arma el paquete CON la
   * bóveda desbloqueada (por eso solo puede ocurrir aquí, en el navegador del titular),
   * lo cifra con una clave de liberación nueva, y sella esa clave contra la llave pública
   * que el contacto generó al pedir acceso. El backend nunca ve nada de esto en claro.
   */
  async function releaseAccess(request: AccessRequest) {
    setReleasingId(request.id);
    setError(null);
    try {
      const contact = contactsById[request.contact_id];

      const [vaultItems, instructions] = await Promise.all([
        api.get<VaultItem[]>("/vault-items"),
        api.get<LegacyInstruction[]>("/legacy-instructions"),
      ]);

      // Filtra por tipo si el contacto tiene permisos restringidos; si no, incluye todo.
      const allowedTypes = contact?.permissions?.vault_item_types as string[] | undefined;
      const relevantItems = allowedTypes?.length
        ? vaultItems.filter((item) => allowedTypes.includes(item.type))
        : vaultItems;

      const decryptedItems = await Promise.all(
        relevantItems.map(async (item) => ({
          type: item.type,
          title: item.title,
          details: await decrypt<VaultItemDetails>(item.encrypted_payload),
        }))
      );

      const relevantInstructions = instructions.filter((i) => i.contact_ids.includes(request.contact_id));
      const decryptedInstructions = await Promise.all(
        relevantInstructions.map(async (instruction) => ({
          title: instruction.title,
          body: await decrypt<string>(instruction.encrypted_body),
        }))
      );

      const releasePackage: ReleasePackage = {
        released_at: new Date().toISOString(),
        vault_items: decryptedItems,
        legacy_instructions: decryptedInstructions,
      };

      // Clave de liberación: simétrica, nueva, de un solo uso para este release.
      const releaseKey = await generateVaultKey();
      const encrypted_release_payload = await encryptJSON(releaseKey, releasePackage);
      const sealed_release_key = await sealForRecipient(request.contact_public_key, releaseKey);

      await api.post<AccessRequest>(`/access-requests/${request.id}/release`, {
        sealed_release_key,
        encrypted_release_payload,
      });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo liberar el acceso.");
    } finally {
      setReleasingId(null);
    }
  }

  const pending = requests?.filter((r) => r.status === "PENDING") ?? [];
  const approved = requests?.filter((r) => r.status === "APPROVED") ?? [];
  const other = requests?.filter((r) => r.status === "DENIED" || r.status === "EXPIRED") ?? [];

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Solicitudes de acceso</h1>
        <p className="mt-1 text-sm text-ink/60">
          Cuando un contacto usa su link de invitación para pedir acceso, aparece aquí.
          Mientras sigas con vida y activo, tú decides qué se aprueba y qué se libera.
        </p>
      </div>

      <ErrorBanner message={error} />

      <div>
        <p className="text-sm font-medium text-ink/70">
          Pendientes {requests !== null && `(${pending.length})`}
        </p>
        <div className="mt-2 flex flex-col gap-3">
          {requests === null && <p className="text-sm text-ink/50">Cargando…</p>}
          {requests !== null && pending.length === 0 && (
            <p className="text-sm text-ink/50">No tienes solicitudes pendientes.</p>
          )}
          {pending.map((request) => {
            const contact = contactsById[request.contact_id];
            return (
              <div key={request.id} className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{contact ? contact.name : "Contacto desconocido"}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[request.status]}`}>
                    {STATUS_LABELS[request.status]}
                  </span>
                </div>
                {contact && <p className="text-xs text-ink/50">{contact.email}</p>}
                <p className="mt-2 text-sm text-ink/70">{request.reason}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => reviewRequest(request.id, "APPROVED")}
                    disabled={updatingId === request.id}
                    className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-paper hover:opacity-90 disabled:opacity-50"
                  >
                    Aprobar
                  </button>
                  <button
                    onClick={() => reviewRequest(request.id, "DENIED")}
                    disabled={updatingId === request.id}
                    className="rounded-md border border-ink/20 px-3 py-1.5 text-xs font-medium hover:bg-ink/5 disabled:opacity-50"
                  >
                    Denegar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-ink/70">
          Aprobadas {requests !== null && `(${approved.length})`}
        </p>
        <div className="mt-2 flex flex-col gap-3">
          {approved.length === 0 && <p className="text-sm text-ink/50">Ninguna por ahora.</p>}
          {approved.map((request) => {
            const contact = contactsById[request.contact_id];
            const isReleased = request.released_at !== null;
            return (
              <div key={request.id} className="rounded-lg border border-green-200 bg-green-50/40 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{contact ? contact.name : "Contacto desconocido"}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[request.status]}`}>
                    {isReleased ? "Acceso liberado" : "Aprobada, sin liberar"}
                  </span>
                </div>
                {contact && <p className="text-xs text-ink/50">{contact.email}</p>}
                <p className="mt-2 text-sm text-ink/70">{request.reason}</p>

                {!isReleased && (
                  <>
                    <button
                      onClick={() => releaseAccess(request)}
                      disabled={!isUnlocked || releasingId === request.id}
                      className="mt-3 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-paper hover:opacity-90 disabled:opacity-50"
                    >
                      {releasingId === request.id ? "Cifrando y liberando…" : "Liberar acceso"}
                    </button>
                    <p className="mt-1 text-xs text-ink/40">
                      Esto descifra y empaqueta los ítems correspondientes, los cifra de nuevo
                      solo para este contacto, y sube el paquete. No es reversible.
                    </p>
                  </>
                )}
                {isReleased && (
                  <p className="mt-2 text-xs text-green-700">
                    Liberado el {new Date(request.released_at!).toLocaleString("es-MX")}. El
                    contacto puede verlo con su link de estado y su llave guardada.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {other.length > 0 && (
        <div>
          <p className="text-sm font-medium text-ink/70">Historial</p>
          <div className="mt-2 flex flex-col gap-3">
            {other.map((request) => {
              const contact = contactsById[request.contact_id];
              return (
                <div key={request.id} className="rounded-lg border border-ink/10 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{contact ? contact.name : "Contacto desconocido"}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[request.status]}`}>
                      {STATUS_LABELS[request.status]}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-ink/70">{request.reason}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
