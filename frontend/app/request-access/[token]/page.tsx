"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { ErrorBanner } from "@/components/ErrorBanner";
import { generateContactKeyPair } from "@/lib/crypto";
import type { AccessRequest } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * Ruta pública: /request-access/[token]
 *
 * NO requiere sesión ni bóveda desbloqueada. El contacto (heredero/albacea) llega aquí con
 * el link que el titular le compartió fuera de banda. El backend identifica al contacto
 * por el invite_token, no por autenticación de cuenta.
 *
 * Al enviar la solicitud, este navegador genera un par de llaves X25519. Solo la pública
 * viaja al servidor (queda guardada en la AccessRequest); la privada se le muestra al
 * contacto UNA vez — es lo único que le permitirá abrir lo que el titular libere después.
 *
 * TODO (ver README): no hay verificación adicional de identidad del contacto antes de
 * aceptar la solicitud, ni ventana de espera / notificación real al titular.
 */
export default function RequestAccessPage({ params }: { params: { token: string } }) {
  const [reason, setReason] = useState("");
  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [confirmedSaved, setConfirmedSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const keyPair = await generateContactKeyPair();

      const res = await fetch(`${API_URL}/access-requests`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invite_token: params.token,
          reason,
          contact_public_key: keyPair.publicKey,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          res.status === 404
            ? "Este link de invitación no es válido. Pide al titular que te comparta uno nuevo."
            : (body?.detail ?? "No se pudo enviar la solicitud.")
        );
      }

      const created: AccessRequest = await res.json();
      void created;
      setSecretKey(keyPair.secretKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar la solicitud.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (secretKey) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
        <div>
          <h1 className="text-2xl font-semibold">Guarda esta llave</h1>
          <p className="mt-2 text-sm text-ink/70">
            Es la <strong>única forma</strong> de ver lo que el titular libere para ti.
            Nadie más la tiene — ni el titular, ni Legado Digital. Cópiala y guárdala en un
            lugar seguro (por ejemplo, en un gestor de contraseñas).
          </p>
        </div>

        <div className="select-all break-all rounded-md border border-accent/30 bg-accent/5 p-4 font-mono text-xs">
          {secretKey}
        </div>

        <label className="flex items-start gap-2 text-sm text-ink/70">
          <input
            type="checkbox"
            checked={confirmedSaved}
            onChange={(e) => setConfirmedSaved(e.target.checked)}
            className="mt-0.5"
          />
          Ya guardé esta llave en un lugar seguro. Entiendo que si la pierdo, no podré ver lo
          que se libere, y nadie podrá recuperarla por mí.
        </label>

        {confirmedSaved && (
          <Link
            href={`/request-access/${params.token}/status`}
            className="rounded-md bg-accent px-4 py-2.5 text-center text-sm font-medium text-paper hover:opacity-90"
          >
            Ir a revisar el estado de mi solicitud
          </Link>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold">Solicitar acceso</h1>
        <p className="mt-2 text-sm text-ink/60">
          Estás pidiendo acceso a información que alguien dejó preparada para ti en Legado
          Digital. Cuéntanos brevemente por qué necesitas acceder ahora.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reason" className="text-sm font-medium text-ink">
            Motivo de la solicitud
          </label>
          <textarea
            id="reason"
            required
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej. Soy el albacea designado y necesito el inventario de cuentas."
            className="rounded-md border border-ink/20 bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>

        <ErrorBanner message={error} />

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-paper hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? "Enviando…" : "Enviar solicitud"}
        </button>
      </form>

      <p className="text-center text-xs text-ink/40">
        Esto no entrega acceso de inmediato: el titular debe aprobarlo.
      </p>
    </main>
  );
}
