"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { ErrorBanner } from "@/components/ErrorBanner";
import { FormField } from "@/components/FormField";
import { useVault } from "@/hooks/useVault";

export default function VaultRecoverPage() {
  const router = useRouter();
  const { recoverWithRecoveryKey, isLoading, error } = useVault();

  const [recoveryKey, setRecoveryKey] = useState("");
  const [newMasterPassword, setNewMasterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);

    if (newMasterPassword.length < 12) {
      setLocalError("Tu nueva master password debe tener al menos 12 caracteres.");
      return;
    }
    if (newMasterPassword !== confirmPassword) {
      setLocalError("Las master passwords no coinciden.");
      return;
    }

    try {
      await recoverWithRecoveryKey(recoveryKey, newMasterPassword);
      router.push("/dashboard");
    } catch {
      // el error ya queda reflejado en `error` del hook
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold">Recuperar bóveda</h1>
        <p className="mt-1 text-sm text-ink/60">
          Usa tu recovery key para entrar y fijar una nueva master password. Tus datos
          existentes no se vuelven a cifrar: solo se actualiza la forma en que se protege
          la clave que ya tienes.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField
          id="recoveryKey"
          label="Recovery key"
          required
          value={recoveryKey}
          onChange={(e) => setRecoveryKey(e.target.value)}
          placeholder="xxxx-xxxx-xxxx-…"
        />
        <FormField
          id="newMasterPassword"
          label="Nueva master password"
          type="password"
          required
          minLength={12}
          value={newMasterPassword}
          onChange={(e) => setNewMasterPassword(e.target.value)}
        />
        <FormField
          id="confirmPassword"
          label="Confirmar nueva master password"
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <ErrorBanner message={localError ?? error} />

        <button
          type="submit"
          disabled={isLoading}
          className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-paper hover:opacity-90 disabled:opacity-50"
        >
          {isLoading ? "Recuperando…" : "Recuperar acceso"}
        </button>
      </form>
    </main>
  );
}
