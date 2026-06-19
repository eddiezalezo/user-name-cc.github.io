"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { ErrorBanner } from "@/components/ErrorBanner";
import { FormField } from "@/components/FormField";
import { useVault } from "@/hooks/useVault";

export default function VaultUnlockPage() {
  const router = useRouter();
  const { unlock, isLoading, error } = useVault();
  const [masterPassword, setMasterPassword] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await unlock(masterPassword);
      router.push("/dashboard");
    } catch {
      // el error ya queda reflejado en `error` del hook
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold">Desbloquea tu bóveda</h1>
        <p className="mt-1 text-sm text-ink/60">
          Introduce tu master password. Se procesa solo en este dispositivo.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField
          id="masterPassword"
          label="Master password"
          type="password"
          required
          autoFocus
          value={masterPassword}
          onChange={(e) => setMasterPassword(e.target.value)}
        />

        <ErrorBanner message={error} />

        <button
          type="submit"
          disabled={isLoading}
          className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-paper hover:opacity-90 disabled:opacity-50"
        >
          {isLoading ? "Verificando…" : "Desbloquear"}
        </button>
      </form>

      <Link href="/vault/recover" className="text-center text-sm text-ink/50 hover:text-ink/80">
        Olvidé mi master password
      </Link>
    </main>
  );
}
