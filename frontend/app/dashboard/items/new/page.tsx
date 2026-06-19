"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { ErrorBanner } from "@/components/ErrorBanner";
import { FormField } from "@/components/FormField";
import { useVault } from "@/hooks/useVault";
import { api, ApiError } from "@/lib/api";
import type { DispositionType, VaultItem, VaultItemDetails, VaultItemType } from "@/lib/types";

const TYPE_OPTIONS: { value: VaultItemType; label: string }[] = [
  { value: "ACCOUNT", label: "Cuenta bancaria" },
  { value: "POLICY", label: "Póliza (seguro)" },
  { value: "PROPERTY", label: "Propiedad / inmueble" },
  { value: "DOCUMENT", label: "Documento importante" },
  { value: "NOTE", label: "Nota" },
  { value: "OTHER", label: "Otro" },
];

export default function NewVaultItemPage() {
  const router = useRouter();
  const { encrypt } = useVault();

  // Campo en claro (mínimo, buscable): NO debe llevar datos sensibles.
  const [title, setTitle] = useState("");
  const [type, setType] = useState<VaultItemType>("ACCOUNT");
  const [tagsInput, setTagsInput] = useState("");
  const [disposition, setDisposition] = useState<DispositionType>("UNDEFINED");

  // Campos sensibles: se cifran antes de enviarse, el backend nunca los ve en claro.
  const [institution, setInstitution] = useState("");
  const [accountOrPolicyNumber, setAccountOrPolicyNumber] = useState("");
  const [beneficiary, setBeneficiary] = useState("");
  const [documentLocation, setDocumentLocation] = useState("");
  const [notes, setNotes] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const details: VaultItemDetails = {
        institution: institution || undefined,
        account_or_policy_number: accountOrPolicyNumber || undefined,
        beneficiary: beneficiary || undefined,
        document_location: documentLocation || undefined,
        notes: notes || undefined,
      };

      // Cifrado en cliente. Esto es lo único que viaja al backend para estos campos.
      const encrypted_payload = await encrypt(details);

      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      await api.post<VaultItem>("/vault-items", {
        type,
        title,
        encrypted_payload,
        tags,
        is_patrimonial: true,
        disposition,
      });

      router.push("/dashboard/items");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar el ítem.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold">Nuevo ítem de inventario</h1>
      <p className="mt-1 text-sm text-ink/60">
        El título y tipo quedan en claro para poder listarlos. Todo lo demás se cifra en tu
        navegador antes de enviarse — el servidor nunca lo ve.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <FormField
          id="title"
          label="Título"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          hint='Evita datos sensibles aquí, ej. "Póliza GNP" en vez de "Póliza GNP #00482931".'
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="type" className="text-sm font-medium text-ink">
            Tipo
          </label>
          <select
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value as VaultItemType)}
            className="rounded-md border border-ink/20 bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-md border border-accent/20 bg-accent/5 p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-accent">
            Detalles sensibles — se cifran antes de enviarse
          </p>
          <div className="flex flex-col gap-3">
            <FormField
              id="institution"
              label="Institución"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
            />
            <FormField
              id="accountOrPolicyNumber"
              label="Número de cuenta / póliza"
              value={accountOrPolicyNumber}
              onChange={(e) => setAccountOrPolicyNumber(e.target.value)}
              hint="Puedes usar solo los últimos dígitos si lo prefieres."
            />
            <FormField
              id="beneficiary"
              label="Beneficiario"
              value={beneficiary}
              onChange={(e) => setBeneficiary(e.target.value)}
            />
            <FormField
              id="documentLocation"
              label="Ubicación del documento físico"
              value={documentLocation}
              onChange={(e) => setDocumentLocation(e.target.value)}
            />
            <FormField id="notes" label="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <FormField
          id="tags"
          label="Etiquetas (separadas por coma)"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="banco, urgente"
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="disposition" className="text-sm font-medium text-ink">
            ¿Qué hacer con esto?
          </label>
          <select
            id="disposition"
            value={disposition}
            onChange={(e) => setDisposition(e.target.value as DispositionType)}
            className="rounded-md border border-ink/20 bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          >
            <option value="UNDEFINED">Aún no decido</option>
            <option value="DELIVER">Entregar a un heredero</option>
            <option value="DELETE">Eliminar</option>
          </select>
        </div>

        <ErrorBanner message={error} />

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-paper hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? "Cifrando y guardando…" : "Guardar ítem"}
        </button>
      </form>
    </div>
  );
}
