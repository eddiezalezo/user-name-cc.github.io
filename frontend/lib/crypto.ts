/**
 * lib/crypto.ts
 * -----------------------------------------------------------------------------------
 * TODA la criptografía de la bóveda vive aquí. El backend JAMÁS recibe master password,
 * recovery key, ni vaultKey en claro — solo los blobs que produce este módulo.
 *
 * Esquema (estilo Bitwarden/1Password, doble envoltura):
 *
 *   vaultKey (DEK, 256 bits, aleatoria) ──┬─► envuelta con masterKey  (de master password)
 *                                          └─► envuelta con recoveryKEK (de recovery key)
 *
 * Por qué NO derivar vaultKey directo de la master password:
 *   - Permitir cambiar la master password sin re-cifrar TODOS los VaultItems (solo se
 *     re-envuelve la vaultKey, ver `rewrapVaultKey`).
 *   - Permitir un segundo camino de recuperación (recovery key) sin debilitar el primero.
 *
 * TODO: revisar y subir los parámetros de Argon2id (OPSLIMIT/MEMLIMIT) según el hardware
 * objetivo. Los valores "MODERATE" de libsodium son un punto de partida razonable para un
 * MVP web (balance UX/seguridad), no el valor final recomendado para producción.
 */
import sodium from "libsodium-wrappers-sumo";
// NOTA: se usa la variante "-sumo" deliberadamente. El paquete "libsodium-wrappers" estándar
// NO incluye crypto_pwhash (Argon2id) — solo la build sumo lo expone. Probado end-to-end:
// setup/unlock/recovery/rewrap/encrypt-decrypt, incluyendo rechazo correcto de password y
// recovery key incorrectos. Costo: ~80KB extra de bundle en las páginas que usan la bóveda
// (ver TODO de code-splitting en README).

let sodiumReady: Promise<typeof sodium> | null = null;

async function getSodium() {
  if (!sodiumReady) {
    sodiumReady = sodium.ready.then(() => sodium);
  }
  return sodiumReady;
}

/** Representación cifrada estándar usada en toda la app: "<nonce_b64>:<ciphertext_b64>" */
export type EncryptedBlob = string;

function packBlob(nonce: Uint8Array, ciphertext: Uint8Array): EncryptedBlob {
  const toB64 = (bytes: Uint8Array) =>
    sodium.to_base64(bytes, sodium.base64_variants.URLSAFE_NO_PADDING);
  return `${toB64(nonce)}:${toB64(ciphertext)}`;
}

function unpackBlob(blob: EncryptedBlob): { nonce: Uint8Array; ciphertext: Uint8Array } {
  const [nonceB64, ciphertextB64] = blob.split(":");
  if (!nonceB64 || !ciphertextB64) {
    throw new Error("Blob cifrado con formato inválido.");
  }
  const fromB64 = (b64: string) =>
    sodium.from_base64(b64, sodium.base64_variants.URLSAFE_NO_PADDING);
  return { nonce: fromB64(nonceB64), ciphertext: fromB64(ciphertextB64) };
}

/** Genera una sal aleatoria (para Argon2id) codificada en base64 url-safe. */
export async function generateSalt(): Promise<string> {
  const s = await getSodium();
  const bytes = s.randombytes_buf(s.crypto_pwhash_SALTBYTES);
  return s.to_base64(bytes, s.base64_variants.URLSAFE_NO_PADDING);
}

/**
 * Deriva una clave simétrica de 256 bits a partir de una passphrase + sal usando Argon2id.
 * Se usa tanto para la master password (KEK #1) como para la recovery key (KEK #2).
 *
 * TODO: subir OPSLIMIT/MEMLIMIT a INTERACTIVE->MODERATE o MODERATE->SENSITIVE según se mida
 * el tiempo de derivación real en dispositivos de gama baja (objetivo: <1.5s en móvil).
 */
export async function deriveKey(passphrase: string, saltB64: string): Promise<Uint8Array> {
  const s = await getSodium();
  const salt = s.from_base64(saltB64, s.base64_variants.URLSAFE_NO_PADDING);
  return s.crypto_pwhash(
    s.crypto_secretbox_KEYBYTES, // 32 bytes, compatible con crypto_aead_xchacha20poly1305_ietf
    passphrase,
    salt,
    s.crypto_pwhash_OPSLIMIT_MODERATE,
    s.crypto_pwhash_MEMLIMIT_MODERATE,
    s.crypto_pwhash_ALG_ARGON2ID13
  );
}

/** Genera una vaultKey (DEK) aleatoria de 256 bits. Esta es la única clave que cifra datos reales. */
export async function generateVaultKey(): Promise<Uint8Array> {
  const s = await getSodium();
  return s.randombytes_buf(s.crypto_aead_xchacha20poly1305_ietf_KEYBYTES);
}

/** Cifra bytes arbitrarios con una clave usando XChaCha20-Poly1305 (AEAD autenticado). */
export async function encryptBytes(key: Uint8Array, plaintext: Uint8Array): Promise<EncryptedBlob> {
  const s = await getSodium();
  const nonce = s.randombytes_buf(s.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const ciphertext = s.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plaintext,
    null, // sin additional data por ahora
    null,
    nonce,
    key
  );
  return packBlob(nonce, ciphertext);
}

/**
 * Descifra un blob. Lanza si la autenticación AEAD falla (password incorrecta, blob
 * corrupto o manipulado) — NUNCA devuelve datos sin verificar.
 */
export async function decryptBytes(key: Uint8Array, blob: EncryptedBlob): Promise<Uint8Array> {
  const s = await getSodium();
  const { nonce, ciphertext } = unpackBlob(blob);
  try {
    return s.crypto_aead_xchacha20poly1305_ietf_decrypt(null, ciphertext, null, nonce, key);
  } catch {
    throw new Error("No se pudo descifrar: clave incorrecta o datos corruptos.");
  }
}

/** Azúcar sintáctica para cifrar/descifrar objetos JSON (lo más común en esta app). */
export async function encryptJSON(key: Uint8Array, data: unknown): Promise<EncryptedBlob> {
  const s = await getSodium();
  const plaintext = s.from_string(JSON.stringify(data));
  return encryptBytes(key, plaintext);
}

export async function decryptJSON<T = unknown>(key: Uint8Array, blob: EncryptedBlob): Promise<T> {
  const s = await getSodium();
  const plaintext = await decryptBytes(key, blob);
  return JSON.parse(s.to_string(plaintext)) as T;
}

/** Genera una recovery key legible/copiable: 32 bytes aleatorios en hex, agrupados. */
export async function generateRecoveryKey(): Promise<string> {
  const s = await getSodium();
  const bytes = s.randombytes_buf(32);
  const hex = s.to_hex(bytes);
  // Se agrupa en bloques de 4 para que sea más fácil de transcribir a mano si hace falta.
  return hex.match(/.{1,4}/g)!.join("-");
}

function normalizeRecoveryKey(recoveryKey: string): string {
  return recoveryKey.replace(/-/g, "").trim().toLowerCase();
}

// ---------------------------------------------------------------------------------------
// Criptografía ASIMÉTRICA (X25519): usada solo para el flujo de liberación de acceso a
// contactos (ver app/request-access y app/dashboard/access-requests). El titular nunca
// conoce la llave PRIVADA del contacto — solo sella datos contra su llave pública.
// ---------------------------------------------------------------------------------------

export interface ContactKeyPair {
  publicKey: string; // base64, no es secreta — viaja al servidor
  secretKey: string; // base64, NUNCA viaja al servidor — el contacto debe guardarla
}

/** El contacto genera esto en su navegador al solicitar acceso por primera vez. */
export async function generateContactKeyPair(): Promise<ContactKeyPair> {
  const s = await getSodium();
  const pair = s.crypto_box_keypair();
  const toB64 = (bytes: Uint8Array) => s.to_base64(bytes, s.base64_variants.URLSAFE_NO_PADDING);
  return { publicKey: toB64(pair.publicKey), secretKey: toB64(pair.privateKey) };
}

/**
 * El TITULAR usa esto para "sellar" una clave simétrica (la clave de liberación) contra
 * la llave pública del contacto. crypto_box_seal es anónimo: ni siquiera el titular puede
 * volver a abrir el sello después — solo quien tiene la llave PRIVADA del contacto puede.
 */
export async function sealForRecipient(recipientPublicKeyB64: string, data: Uint8Array): Promise<string> {
  const s = await getSodium();
  const fromB64 = (b64: string) => s.from_base64(b64, s.base64_variants.URLSAFE_NO_PADDING);
  const toB64 = (bytes: Uint8Array) => s.to_base64(bytes, s.base64_variants.URLSAFE_NO_PADDING);
  const publicKey = fromB64(recipientPublicKeyB64);
  const sealed = s.crypto_box_seal(data, publicKey);
  return toB64(sealed);
}

/** El CONTACTO usa esto con su llave privada guardada para abrir lo que le sellaron. */
export async function openSealed(secretKeyB64: string, sealedB64: string): Promise<Uint8Array> {
  const s = await getSodium();
  const fromB64 = (b64: string) => s.from_base64(b64, s.base64_variants.URLSAFE_NO_PADDING);
  const secretKey = fromB64(secretKeyB64);
  // La llave pública se puede re-derivar de la privada (X25519): no hace falta guardarla aparte.
  const publicKey = s.crypto_scalarmult_base(secretKey);
  const sealed = fromB64(sealedB64);
  try {
    return s.crypto_box_seal_open(sealed, publicKey, secretKey);
  } catch {
    throw new Error("No se pudo abrir el paquete: la llave privada no corresponde o el paquete está corrupto.");
  }
}

// ---------------------------------------------------------------------------------------
// Flujos de alto nivel: setup, unlock, recovery, rewrap. Estos son los que usa useVault.tsx.
// ---------------------------------------------------------------------------------------

export interface VaultSetupResult {
  vaultKey: Uint8Array;
  vault_salt: string;
  protected_vault_key: EncryptedBlob;
  recovery_salt: string;
  protected_vault_key_recovery: EncryptedBlob;
  vault_header_check: EncryptedBlob;
  recoveryKeyPlaintext: string; // mostrar UNA vez al usuario; nunca se envía al backend
}

const VAULT_HEADER_CHECK_PAYLOAD = { check: "legado-digital-vault-v1" };

/** Crea una bóveda nueva: genera vaultKey + recovery key y envuelve todo. Todo en cliente. */
export async function setupNewVault(masterPassword: string): Promise<VaultSetupResult> {
  const vaultKey = await generateVaultKey();

  const vault_salt = await generateSalt();
  const masterKey = await deriveKey(masterPassword, vault_salt);
  const protected_vault_key = await encryptBytes(masterKey, vaultKey);

  const recoveryKeyPlaintext = await generateRecoveryKey();
  const recovery_salt = await generateSalt();
  const recoveryKEK = await deriveKey(normalizeRecoveryKey(recoveryKeyPlaintext), recovery_salt);
  const protected_vault_key_recovery = await encryptBytes(recoveryKEK, vaultKey);

  const vault_header_check = await encryptJSON(vaultKey, VAULT_HEADER_CHECK_PAYLOAD);

  return {
    vaultKey,
    vault_salt,
    protected_vault_key,
    recovery_salt,
    protected_vault_key_recovery,
    vault_header_check,
    recoveryKeyPlaintext,
  };
}

/**
 * Intenta desbloquear la bóveda con la master password. Devuelve la vaultKey si la
 * password es correcta, o lanza un error si no lo es (la verificación AEAD falla).
 */
export async function unlockVault(
  masterPassword: string,
  material: { vault_salt: string; protected_vault_key: EncryptedBlob; vault_header_check: EncryptedBlob }
): Promise<Uint8Array> {
  const masterKey = await deriveKey(masterPassword, material.vault_salt);
  const vaultKey = await decryptBytes(masterKey, material.protected_vault_key);
  // Verificación extra explícita contra el header conocido, por claridad de errores.
  await decryptJSON(vaultKey, material.vault_header_check);
  return vaultKey;
}

/** Igual que unlockVault pero usando la recovery key en vez de la master password. */
export async function recoverVault(
  recoveryKeyPlaintext: string,
  material: { recovery_salt: string; protected_vault_key_recovery: EncryptedBlob; vault_header_check: EncryptedBlob }
): Promise<Uint8Array> {
  const recoveryKEK = await deriveKey(normalizeRecoveryKey(recoveryKeyPlaintext), material.recovery_salt);
  const vaultKey = await decryptBytes(recoveryKEK, material.protected_vault_key_recovery);
  await decryptJSON(vaultKey, material.vault_header_check);
  return vaultKey;
}

/**
 * Re-envuelve una vaultKey YA existente con una nueva master password. Se usa al cambiar
 * la password o justo después de recuperar la bóveda con la recovery key. Los VaultItems
 * cifrados NO se tocan: siguen usando la misma vaultKey.
 */
export async function rewrapVaultKey(
  vaultKey: Uint8Array,
  newMasterPassword: string
): Promise<{ vault_salt: string; protected_vault_key: EncryptedBlob; vault_header_check: EncryptedBlob }> {
  const vault_salt = await generateSalt();
  const masterKey = await deriveKey(newMasterPassword, vault_salt);
  const protected_vault_key = await encryptBytes(masterKey, vaultKey);
  const vault_header_check = await encryptJSON(vaultKey, VAULT_HEADER_CHECK_PAYLOAD);
  return { vault_salt, protected_vault_key, vault_header_check };
}
