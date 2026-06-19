// Tipos espejo de los schemas Pydantic del backend (ver backend/app/schemas/*.py).
// Los campos *_payload / *_body / *_content llegan SIEMPRE cifrados (EncryptedBlob,
// formato "<nonce_b64>:<ciphertext_b64>") y deben descifrarse con la vaultKey en cliente.

import type { EncryptedBlob } from "./crypto";

export type PlanType = "FREE" | "PERSONAL" | "FAMILIAR" | "PATRIMONIAL";

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  country: string | null;
  plan: PlanType;
  has_recovery_key: boolean;
  created_at: string;
}

export interface VaultProfileMaterial {
  vault_salt: string;
  protected_vault_key: EncryptedBlob;
  vault_header_check: EncryptedBlob;
}

export type VaultItemType = "ACCOUNT" | "POLICY" | "PROPERTY" | "DOCUMENT" | "NOTE" | "OTHER";
export type DispositionType = "DELIVER" | "DELETE" | "UNDEFINED";

export interface VaultItem {
  id: string;
  type: VaultItemType;
  title: string;
  encrypted_payload: EncryptedBlob;
  tags: string[];
  is_patrimonial: boolean;
  disposition: DispositionType;
  created_at: string;
  updated_at: string;
}

/** Forma del JSON que viaja DENTRO de encrypted_payload, una vez descifrado. */
export interface VaultItemDetails {
  institution?: string;
  account_or_policy_number?: string;
  document_location?: string;
  beneficiary?: string;
  notes?: string;
  [key: string]: unknown;
}

export interface VaultDocument {
  id: string;
  vault_item_id: string;
  storage_key: string;
  encrypted_metadata: EncryptedBlob;
  size_bytes: number;
  created_at: string;
}

/** Forma del JSON que viaja DENTRO de encrypted_metadata de un VaultDocument. */
export interface VaultDocumentMetadata {
  filename: string;
  mime: string;
}

export type ContactRole = "SPOUSE" | "HEIR" | "EXECUTOR" | "LAWYER" | "OTHER";

export interface Contact {
  id: string;
  name: string;
  email: string;
  role: ContactRole;
  permissions: Record<string, unknown>;
  encrypted_additional_info: EncryptedBlob | null;
  invite_token: string;
  created_at: string;
}

export type TriggerType = "DEATH" | "INCAPACITY" | "TIME_DELAY" | "OTHER";
export type InstructionStatus = "DRAFT" | "ACTIVE" | "REVOKED";

export interface LegacyInstruction {
  id: string;
  title: string;
  encrypted_body: EncryptedBlob;
  trigger: TriggerType;
  status: InstructionStatus;
  contact_ids: string[];
  created_at: string;
  updated_at: string;
}

export type MessageType = "TEXT" | "AUDIO" | "VIDEO";
export type MessageStatus = "DRAFT" | "SCHEDULED" | "DELIVERED" | "REVOKED";

export interface LegacyMessage {
  id: string;
  contact_id: string;
  type: MessageType;
  encrypted_content: EncryptedBlob;
  trigger: TriggerType;
  status: MessageStatus;
  created_at: string;
  updated_at: string;
}

export type AccessRequestStatus = "PENDING" | "APPROVED" | "DENIED" | "EXPIRED";

export interface AccessRequest {
  id: string;
  contact_id: string;
  reason: string;
  status: AccessRequestStatus;
  contact_public_key: string;
  sealed_release_key: EncryptedBlob | null;
  encrypted_release_payload: EncryptedBlob | null;
  released_at: string | null;
  created_at: string;
  updated_at: string;
}
