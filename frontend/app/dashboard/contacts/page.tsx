"use client";

import { useEffect, useState, type FormEvent } from "react";

import { ErrorBanner } from "@/components/ErrorBanner";
import { FormField } from "@/components/FormField";
import { api, ApiError } from "@/lib/api";
import type { Contact, ContactRole } from "@/lib/types";

const ROLE_LABELS: Record<ContactRole, string> = {
  SPOUSE: "Cónyuge",
  HEIR: "Heredero",
  EXECUTOR: "Albacea",
  LAWYER: "Abogado",
  OTHER: "Otro",
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ContactRole>("HEIR");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadContacts() {
    try {
      const data = await api.get<Contact[]>("/contacts");
      setContacts(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar los contactos.");
    }
  }

  useEffect(() => {
    loadContacts();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post<Contact>("/contacts", { name, email, role, permissions: {} });
      setName("");
      setEmail("");
      await loadContacts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear el contacto.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Contactos de confianza</h1>
        <p className="mt-1 text-sm text-ink/60">
          Herederos, albacea y otras personas que podrán solicitar acceso bajo tus reglas.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-lg border border-ink/10 bg-white p-4">
        <FormField id="name" label="Nombre" required value={name} onChange={(e) => setName(e.target.value)} />
        <FormField
          id="email"
          label="Correo"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="role" className="text-sm font-medium text-ink">
            Rol
          </label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value as ContactRole)}
            className="rounded-md border border-ink/20 bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          >
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-paper hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? "Agregando…" : "Agregar"}
        </button>
      </form>

      <ErrorBanner message={error} />

      <div className="flex flex-col gap-3">
        {contacts?.map((contact) => (
          <div key={contact.id} className="rounded-lg border border-ink/10 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">{contact.name}</p>
              <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs text-ink/60">
                {ROLE_LABELS[contact.role]}
              </span>
            </div>
            <p className="text-sm text-ink/60">{contact.email}</p>
            <p className="mt-2 text-xs text-ink/40">
              Link de invitación (compártelo fuera de banda, ej. en persona o por una vía que
              ya usen):
              <br />
              <span className="select-all font-mono text-ink/60">
                {typeof window !== "undefined" ? window.location.origin : ""}/request-access/
                {contact.invite_token}
              </span>
            </p>
          </div>
        ))}
        {contacts?.length === 0 && <p className="text-sm text-ink/50">Aún no has agregado contactos.</p>}
      </div>
    </div>
  );
}
