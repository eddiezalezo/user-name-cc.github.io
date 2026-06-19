"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { ErrorBanner } from "@/components/ErrorBanner";
import { FormField } from "@/components/FormField";
import { useVault } from "@/hooks/useVault";

type Step = "form" | "show-recovery-key";

export default function VaultSetupPage() {
  const router = useRouter();
  const { setupVault, isLoading, error } = useVault();

  const [step, setStep] = useState<Step>("form");
  const [masterPassword, setMasterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [confirmedSaved, setConfirmedSaved] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);

    if (masterPassword.length < 12) {
      setLocalError("Tu master password debe tener al menos 12 caracteres.");
      return;
    }
    if (masterPassword !== confirmPassword) {
      setLocalError("Las master passwords no coinciden.");
      return;
    }

    try {
      const key = await setupVault(masterPassword);
      setRecoveryKey(key);
      setStep("show-recovery-key");
    } catch {
      // el error ya queda reflejado en `error` del hook
    }
  }

  if (step === "show-recovery-key" && recoveryKey) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
        <div>
          <h1 className="text-2xl font-semibold">Guarda tu recovery key</h1>
          <p className="mt-2 text-sm text-ink/70">
            Es la <strong>única forma</strong> de recuperar tu bóveda si olvidas tu master
            password. Nosotros no la guardamos en ningún lugar y no podemos regenerarla.
            Cópiala e imprímela o guárdala en un lugar seguro fuera de esta computadora.
          </p>
        </div>

        <div className="select-all rounded-md border border-accent/30 bg-accent/5 p-4 font-mono text-sm tracking-wide">
          {recoveryKey}
        </div>

        <label className="flex items-start gap-2 text-sm text-ink/70">
          <input
            type="checkbox"
            checked={confirmedSaved}
            onChange={(e) => setConfirmedSaved(e.target.checked)}
            className="mt-0.5"
          />
          Ya guardé mi recovery key en un lugar seguro. Entiendo que si la pierdo junto con mi
          master password, mis datos no podrán recuperarse.
        </label>

        <button
          type="button"
          disabled={!confirmedSaved}
          onClick={() => router.push("/dashboard")}
          className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-paper hover:opacity-90 disabled:opacity-50"
        >
          Continuar al dashboard
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold">Configura tu bóveda</h1>
        <p className="mt-2 text-sm text-ink/70">
          Esta master password cifra toda tu información. Es distinta de tu contraseña de
          cuenta y <strong>nosotros nunca la conocemos ni podemos recuperarla</strong>.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField
          id="masterPassword"
          label="Master password"
          type="password"
          required
          minLength={12}
          value={masterPassword}
          onChange={(e) => setMasterPassword(e.target.value)}
          hint="Mínimo 12 caracteres. Idealmente una frase larga y fácil de recordar para ti, difícil para otros."
        />
        <FormField
          id="confirmMasterPassword"
          label="Confirmar master password"
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
          {isLoading ? "Configurando…" : "Crear bóveda"}
        </button>
      </form>
    </main>
  );
}
