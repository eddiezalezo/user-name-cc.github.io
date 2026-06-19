"use client";

import { useEffect, useState, type FormEvent } from "react";

import { ErrorBanner } from "@/components/ErrorBanner";
import { FormField } from "@/components/FormField";
import { useVault } from "@/hooks/useVault";
import { api, ApiError } from "@/lib/api";
import type { Contact, LegacyInstruction, TriggerType } from "@/lib/types";

const TRIGGER_LABELS: Record<TriggerType, string> = {
  DEATH: "Fallecimiento",
  INCAPACITY: "Incapacidad",
  TIME_DELAY: "Tiempo sin actividad",
  OTHER: "Otro",
};

interface DecryptedInstruction {
  instruction: LegacyInstruction;
  body: string | null;
}

export default function InstructionsPage() {
  const { encrypt, decrypt } = useVault();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [rows, setRows] = useState<DecryptedInstruction[] | null>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [trigger, setTrigger] = useState<TriggerType>("DEATH");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadAll() {
    try {
      const [instructions, contactList] = await Promise.all([
        api.get<LegacyInstruction[]>("/legacy-instructions"),
        api.get<Contact[]>("/contacts"),
      ]);
      setContacts(contactList);

      const decrypted = await Promise.all(
        instructions.map(async (instruction) => {
          try {
            const decryptedBody = await decrypt<string>(instruction.encrypted_body);
            return { instruction, body: decryptedBody };
          } catch {
            return { instruction, body: null };
          }
        })
      );
      setRows(decrypted);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar la información.");
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleContact(id: string) {
    setSelectedContactIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const encrypted_body = await encrypt(body);
      await api.post<LegacyInstruction>("/legacy-instructions", {
        title,
        encrypted_body,
        trigger,
        contact_ids: selectedContactIds,
        status: "ACTIVE",
      });
      setTitle("");
      setBody("");
      setSelectedContactIds([]);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar la instrucción.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Instrucciones de legado</h1>
        <p className="mt-1 text-sm text-ink/60">
          Qué debe hacer cada contacto y bajo qué evento. El cuerpo se cifra en tu navegador.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-ink/10 bg-white p-4">
        <FormField id="title" label="Título" required value={title} onChange={(e) => setTitle(e.target.value)} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="body" className="text-sm font-medium text-ink">
            Instrucción (se cifra antes de enviarse)
          </label>
          <textarea
            id="body"
            required
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="rounded-md border border-ink/20 bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="trigger" className="text-sm font-medium text-ink">
            Se activa ante
          </label>
          <select
            id="trigger"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value as TriggerType)}
            className="rounded-md border border-ink/20 bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          >
            {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="text-sm font-medium text-ink">Destinatarios</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {contacts.map((contact) => (
              <label
                key={contact.id}
                className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${
                  selectedContactIds.includes(contact.id)
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-ink/15 text-ink/60"
                }`}
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={selectedContactIds.includes(contact.id)}
                  onChange={() => toggleContact(contact.id)}
                />
                {contact.name}
              </label>
            ))}
            {contacts.length === 0 && (
              <p className="text-xs text-ink/40">Agrega contactos primero para poder seleccionarlos.</p>
            )}
          </div>
        </div>

        <ErrorBanner message={error} />

        <button
          type="submit"
          disabled={isSubmitting}
          className="self-start rounded-md bg-accent px-4 py-2 text-sm font-medium text-paper hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? "Cifrando y guardando…" : "Guardar instrucción"}
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {rows?.map(({ instruction, body: decryptedBody }) => (
          <div key={instruction.id} className="rounded-lg border border-ink/10 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">{instruction.title}</p>
              <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs text-ink/60">
                {TRIGGER_LABELS[instruction.trigger]}
              </span>
            </div>
            <p className="mt-2 text-sm text-ink/70">{decryptedBody ?? "(no se pudo descifrar)"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
