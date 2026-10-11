import { Identity } from "@semaphore-protocol/core";

export function createIdentity(): Identity {
  return new Identity();
}

export function exportIdentity(identity: Identity): string {
  return identity.export();
}

export function importIdentity(exported: string): Identity {
  if (!exported || typeof exported !== "string") {
    throw new Error("Please provide a valid identity backup.");
  }

  try {
    const normalized = exported.trim();

    if (
      !normalized ||
      normalized.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)
    ) {
      throw new Error("Invalid Base64 identity backup.");
    }

    const binary = atob(normalized);
    const privateKey = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0)
    );

    if (
      privateKey.length === 0 ||
      btoa(String.fromCharCode(...privateKey)) !== normalized
    ) {
      throw new Error("Invalid identity backup.");
    }

    return new Identity(privateKey);
  } catch {
    throw new Error(
      "Could not restore the identity. Check that you selected the correct backup."
    );
  }
}
