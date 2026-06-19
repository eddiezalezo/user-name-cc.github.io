"use client";

import { useEffect, useState, type FormEvent } from "react";

import { ErrorBanner } from "@/components/ErrorBanner";
import { FormField } from "@/components/FormField";
import { useVault } from "@/hooks/useVault";
import { api, ApiError } from "@/lib/api";
import type { Contact, LegacyMessage, TriggerType } from "@/lib/types";

const TRIGGER_LABELS: Record<TriggerType, string> = {
  DEATH: "Fallecimiento",
  INCAPACITY: "Incapacidad",
  TIME_DELAY: "Tiempo sin actividad",
  OTHER: "Otro",
};

interface DecryptedMessage {
  message: LegacyMessage;
  content: string | null;
}

export default function MessagesPage() {
  const { encrypt, decrypt } = useVault();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [rows, setRows] = useState<DecryptedMessage[] | null>(null);

  const [contactId, setContactId] = useState("");
  const [content, setContent] = useState("");
  const [trigger, setTrigger] = useState<TriggerType>("DEATH");

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadAll() {
    try {
      const [messages, contactList] = await Promise.all([
        api.get<LegacyMessage[]>("/legacy-messages"),
        api.get<Contact[]>("/contacts"),
      ]);
      setContacts(contactList);
      if (!contactId && contactList.length > 0) setContactId(contactList[0].id);

      const decrypted = await Promise.all(
        messages.map(async (message) => {
          try {
            const decryptedContent = await decrypt<string>(message.encrypted_content);
            return { message, content: decryptedContent };
          } catch {
            return { message, content: null };
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!contactId) {
      setError("Agrega al menos un contacto antes de crear un mensaje.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const encrypted_content = await encrypt(content);
      await api.post<LegacyMessage>("/legacy-messages", {
        contact_id: contactId,
        type: "TEXT",
        encrypted_content,
        trigger,
        status: "SCHEDULED",
      });
      setContent("");
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar el mensaje.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Mensajes póstumos</h1>
        <p className="mt-1 text-sm text-ink/60">
          Por ahora solo texto. Audio y video quedan como TODO (ver README).
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-ink/10 bg-white p-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="contact" className="text-sm font-medium text-ink">
            Destinatario
          </label>
          <select
            id="contact"
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            className="rounded-md border border-ink/20 bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          >
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="content" className="text-sm font-medium text-ink">
            Mensaje (se cifra antes de enviarse)
          </label>
          <textarea
            id="content"
            required
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="rounded-md border border-ink/20 bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="trigger" className="text-sm font-medium text-ink">
            Se entrega ante
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

        <ErrorBanner message={error} />

        <button
          type="submit"
          disabled={isSubmitting || contacts.length === 0}
          className="self-start rounded-md bg-accent px-4 py-2 text-sm font-medium text-paper hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? "Cifrando y guardando…" : "Guardar mensaje"}
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {rows?.map(({ message, content: decryptedContent }) => (
          <div key={message.id} className="rounded-lg border border-ink/10 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs text-ink/60">
                {TRIGGER_LABELS[message.trigger]} · {message.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-ink/70">{decryptedContent ?? "(no se pudo descifrar)"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
