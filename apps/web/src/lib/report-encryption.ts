export type EncryptedReport = {
    version: 1;
    wrappedKey: string;
    iv: string;
    ciphertext: string;
};

function pemToArrayBuffer(pem: string): ArrayBuffer {
    const base64 = pem
        .replace(/-----BEGIN PUBLIC KEY-----/g, "")
        .replace(/-----END PUBLIC KEY-----/g, "")
        .replace(/\s/g, "");

    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) =>
        character.charCodeAt(0)
    );

    return bytes.buffer;
}

function toBase64(data: ArrayBuffer): string {
    const bytes = new Uint8Array(data);
    let binary = "";

    for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]);
    }

    return btoa(binary);
}

export async function encryptReport(
    report: { category: string; body: string },
    publicKeyPem: string
): Promise<EncryptedReport> {
    if (!globalThis.crypto?.subtle) {
        throw new Error("Secure browser encryption is unavailable.");
    }

    const publicKey = await crypto.subtle.importKey(
        "spki",
        pemToArrayBuffer(publicKeyPem),
        { name: "RSA-OAEP", hash: "SHA-256" },
        false,
        ["encrypt"]
    );

    const aesKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt"]
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(report));

    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        aesKey,
        plaintext
    );

    const rawAesKey = await crypto.subtle.exportKey("raw", aesKey);
    const wrappedKey = await crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        publicKey,
        rawAesKey
    );

    return {
        version: 1,
        wrappedKey: toBase64(wrappedKey),
        iv: toBase64(iv.buffer),
        ciphertext: toBase64(ciphertext),
    };
}
