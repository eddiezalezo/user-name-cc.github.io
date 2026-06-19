"use client";

/**
 * hooks/useVault.tsx
 * -----------------------------------------------------------------------------------
 * Mantiene la vaultKey SOLO en memoria de React (useState). Nunca se persiste en
 * localStorage, sessionStorage, IndexedDB ni cookies. Si el usuario recarga la página,
 * la bóveda vuelve a estado "bloqueado" y debe introducir su master password de nuevo.
 *
 * Esto es una decisión deliberada de seguridad, no un descuido: es el mismo trade-off
 * UX/seguridad que hacen los password managers zero-knowledge.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { api } from "@/lib/api";
import {
  decryptJSON,
  encryptJSON,
  recoverVault,
  rewrapVaultKey,
  setupNewVault,
  unlockVault,
  type EncryptedBlob,
} from "@/lib/crypto";
import type { VaultProfileMaterial } from "@/lib/types";

interface VaultContextValue {
  isUnlocked: boolean;
  isLoading: boolean;
  error: string | null;

  /** La clave cruda, solo para casos que no son JSON (ej. archivos en lib/files.ts).
   * Sigue viviendo únicamente en memoria de este componente — no se persiste en ningún lado. */
  vaultKey: Uint8Array | null;

  /** Crea la bóveda por primera vez. Devuelve la recovery key para mostrarla UNA vez. */
  setupVault: (masterPassword: string) => Promise<string>;
  /** Intenta desbloquear con la master password actual. */
  unlock: (masterPassword: string) => Promise<void>;
  /** Intenta recuperar acceso usando la recovery key, y fija una nueva master password. */
  recoverWithRecoveryKey: (recoveryKey: string, newMasterPassword: string) => Promise<void>;
  /** Borra la vaultKey de memoria (ej. al cerrar sesión o por inactividad). */
  lock: () => void;

  /** Azúcar sintáctica para cifrar/descifrar contra la vaultKey actual. */
  encrypt: (data: unknown) => Promise<EncryptedBlob>;
  decrypt: <T = unknown>(blob: EncryptedBlob) => Promise<T>;
}

const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [vaultKey, setVaultKey] = useState<Uint8Array | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setupVault = useCallback(async (masterPassword: string): Promise<string> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await setupNewVault(masterPassword);
      await api.post("/vault/setup", {
        vault_salt: result.vault_salt,
        protected_vault_key: result.protected_vault_key,
        recovery_salt: result.recovery_salt,
        protected_vault_key_recovery: result.protected_vault_key_recovery,
        vault_header_check: result.vault_header_check,
      });
      setVaultKey(result.vaultKey);
      return result.recoveryKeyPlaintext;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo configurar la bóveda.");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const unlock = useCallback(async (masterPassword: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const material = await api.get<VaultProfileMaterial>("/vault/unlock-material");
      const key = await unlockVault(masterPassword, material);
      setVaultKey(key);
    } catch {
      setError("Master password incorrecta, o la bóveda aún no ha sido configurada.");
      throw new Error("unlock_failed");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const recoverWithRecoveryKey = useCallback(
    async (recoveryKey: string, newMasterPassword: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const material = await api.get<{
          recovery_salt: string;
          protected_vault_key_recovery: EncryptedBlob;
          vault_header_check: EncryptedBlob;
        }>("/vault/recovery-material");

        const key = await recoverVault(recoveryKey, material);

        const rewrapped = await rewrapVaultKey(key, newMasterPassword);
        await api.post("/vault/rewrap", rewrapped);

        setVaultKey(key);
      } catch {
        setError("Recovery key incorrecta. Si la perdiste junto con tu master password, los datos no son recuperables.");
        throw new Error("recovery_failed");
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const lock = useCallback(() => {
    setVaultKey(null);
  }, []);

  const encrypt = useCallback(
    async (data: unknown): Promise<EncryptedBlob> => {
      if (!vaultKey) throw new Error("La bóveda está bloqueada.");
      return encryptJSON(vaultKey, data);
    },
    [vaultKey]
  );

  const decrypt = useCallback(
    async <T,>(blob: EncryptedBlob): Promise<T> => {
      if (!vaultKey) throw new Error("La bóveda está bloqueada.");
      return decryptJSON<T>(vaultKey, blob);
    },
    [vaultKey]
  );

  const value = useMemo<VaultContextValue>(
    () => ({
      isUnlocked: vaultKey !== null,
      isLoading,
      error,
      vaultKey,
      setupVault,
      unlock,
      recoverWithRecoveryKey,
      lock,
      encrypt,
      decrypt,
    }),
    [vaultKey, isLoading, error, setupVault, unlock, recoverWithRecoveryKey, lock, encrypt, decrypt]
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault debe usarse dentro de <VaultProvider>.");
  return ctx;
}
