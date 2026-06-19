"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useVault } from "@/hooks/useVault";
import { api, ApiError } from "@/lib/api";
import type { VaultItem, VaultItemDetails } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  ACCOUNT: "Cuenta bancaria",
  POLICY: "Póliza",
  PROPERTY: "Propiedad",
  DOCUMENT: "Documento",
  NOTE: "Nota",
  OTHER: "Otro",
};

/** Fila que ya descifró su payload (o falló al hacerlo). */
interface DecryptedRow {
  item: VaultItem;
  details: VaultItemDetails | null;
  decryptError: boolean;
}

export default function VaultItemsPage() {
  const { decrypt } = useVault();
  const [rows, setRows] = useState<DecryptedRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const items = await api.get<VaultItem[]>("/vault-items");
        const decrypted = await Promise.all(
          items.map(async (item) => {
            try {
              const details = await decrypt<VaultItemDetails>(item.encrypted_payload);
              return { item, details, decryptError: false };
            } catch {
              return { item, details: null, decryptError: true };
            }
          })
        );
        if (!cancelled) setRows(decrypted);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "No se pudo cargar el inventario.");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [decrypt]);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Inventario</h1>
        <Link
          href="/dashboard/items/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-paper hover:opacity-90"
        >
          + Agregar ítem
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {rows === null && !error && <p className="text-sm text-ink/50">Descifrando inventario…</p>}
      {rows !== null && rows.length === 0 && (
        <p className="text-sm text-ink/50">Aún no has agregado ningún ítem.</p>
      )}

      <div className="flex flex-col gap-3">
        {rows?.map(({ item, details, decryptError }) => (
          <div key={item.id} className="rounded-lg border border-ink/10 bg-white p-4">
            <div className="flex items-center justify-between">
              <Link href={`/dashboard/items/${item.id}`} className="font-medium hover:text-accent hover:underline">
                {item.title}
              </Link>
              <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs text-ink/60">
                {TYPE_LABELS[item.type] ?? item.type}
              </span>
            </div>

            {decryptError && (
              <p className="mt-2 text-sm text-red-600">
                No se pudo descifrar este ítem con la vaultKey actual.
              </p>
            )}

            {details && (
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-ink/70">
                {details.institution && (
                  <>
                    <dt className="text-ink/40">Institución</dt>
                    <dd>{details.institution}</dd>
                  </>
                )}
                {details.account_or_policy_number && (
                  <>
                    <dt className="text-ink/40">Número</dt>
                    <dd>{details.account_or_policy_number}</dd>
                  </>
                )}
                {details.beneficiary && (
                  <>
                    <dt className="text-ink/40">Beneficiario</dt>
                    <dd>{details.beneficiary}</dd>
                  </>
                )}
                {details.document_location && (
                  <>
                    <dt className="text-ink/40">Ubicación del documento</dt>
                    <dd>{details.document_location}</dd>
                  </>
                )}
              </dl>
            )}

            {item.tags.length > 0 && (
              <div className="mt-3 flex gap-1.5">
                {item.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
