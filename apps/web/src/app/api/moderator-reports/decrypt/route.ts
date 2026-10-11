import { get } from "@vercel/blob";
import {
    constants,
    privateDecrypt,
    createDecipheriv,
} from "node:crypto";
import { NextResponse } from "next/server";
import { isModeratorAuthenticated } from "@/lib/moderator-auth";

function decodeBase64(value: string): Buffer {
    if (
        !value ||
        value.length > 200_000 ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
    ) {
        throw new Error("Invalid encrypted data.");
    }

    return Buffer.from(value, "base64");
}

export async function POST(request: Request) {
    const noStore = { "Cache-Control": "no-store" };

    if (!(await isModeratorAuthenticated())) {
        return NextResponse.json(
            { error: "Authentication required." },
            { status: 401, headers: noStore }
        );
    }

    let body: unknown;

    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: "Invalid request." },
            { status: 400, headers: noStore }
        );
    }

    if (
        !body ||
        typeof body !== "object" ||
        !("reportId" in body) ||
        typeof body.reportId !== "string" ||
        !/^[0-9a-f-]{36}$/i.test(body.reportId)
    ) {
        return NextResponse.json(
            { error: "Invalid report ID." },
            { status: 400, headers: noStore }
        );
    }

    try {
        const reportId = body.reportId;

        const stored = await get(
            `reports/${reportId}.json`,
            { access: "private" }
        );

        if (!stored || stored.statusCode !== 200 || !stored.stream) {
            return NextResponse.json(
                { error: "Report not found." },
                { status: 404, headers: noStore }
            );
        }

        const rawReport = await new Response(stored.stream).text();

        if (rawReport.length > 256 * 1024) {
            throw new Error("Stored report exceeds size limit.");
        }

        const encrypted = JSON.parse(rawReport) as {
            version?: unknown;
            wrappedKey?: unknown;
            iv?: unknown;
            ciphertext?: unknown;
        };

        if (
            encrypted.version !== 1 ||
            typeof encrypted.wrappedKey !== "string" ||
            typeof encrypted.iv !== "string" ||
            typeof encrypted.ciphertext !== "string"
        ) {
            throw new Error("Invalid report format.");
        }

        const configuredKey = process.env.MODERATOR_PRIVATE_KEY;

        if (!configuredKey) {
            throw new Error("Moderator private key is not configured.");
        }

        const privateKey = configuredKey.replace(/\\n/g, "\n");

        const aesKey = privateDecrypt(
            {
                key: privateKey,
                padding: constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: "sha256",
            },
            decodeBase64(encrypted.wrappedKey)
        );

        if (aesKey.length !== 32) {
            throw new Error("Invalid encryption key.");
        }

        const iv = decodeBase64(encrypted.iv);
        const ciphertext = decodeBase64(encrypted.ciphertext);

        if (iv.length !== 12 || ciphertext.length < 16) {
            throw new Error("Invalid encrypted payload.");
        }

        const decipher = createDecipheriv("aes-256-gcm", aesKey, iv);
        const authTag = ciphertext.subarray(ciphertext.length - 16);
        const encryptedContent = ciphertext.subarray(0, -16);

        decipher.setAuthTag(authTag);

        const plaintext = Buffer.concat([
            decipher.update(encryptedContent),
            decipher.final(),
        ]).toString("utf8");

        const report: unknown = JSON.parse(plaintext);

        if (
            !report ||
            typeof report !== "object" ||
            !("category" in report) ||
            typeof report.category !== "string" ||
            !("body" in report) ||
            typeof report.body !== "string"
        ) {
            throw new Error("Invalid report contents.");
        }

        return NextResponse.json(
            {
                reportId,
                category: report.category,
                body: report.body,
            },
            { headers: noStore }
        );
    } catch (error) {
        console.error("Moderator report retrieval failed:", error);

        return NextResponse.json(
            { error: "Could not decrypt this report." },
            { status: 422, headers: noStore }
        );
    }
}
