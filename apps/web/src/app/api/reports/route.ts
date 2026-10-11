import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { EncryptedReport } from "@/lib/report-encryption";

const MAX_REQUEST_BYTES = 256 * 1024;

function originIsAllowed(request: Request): boolean {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");

    if (!origin || !host) {
        return false;
    }

    try {
        const parsedOrigin = new URL(origin);
        const requestUrl = new URL(request.url);

        // Require the browser origin to match the request's host
        // and protocol. Reject malformed origins and "null" origins.
        return (
            parsedOrigin.origin === requestUrl.origin &&
            parsedOrigin.host === host
        );
    } catch {
        return false;
    }
}

function isEncryptedReport(value: unknown): value is EncryptedReport {
    if (!value || typeof value !== "object") {
        return false;
    }

    const report = value as Record<string, unknown>;

    return (
        report.version === 1 &&
        typeof report.wrappedKey === "string" &&
        report.wrappedKey.length > 0 &&
        report.wrappedKey.length <= 20_000 &&
        typeof report.iv === "string" &&
        report.iv.length > 0 &&
        report.iv.length <= 100 &&
        typeof report.ciphertext === "string" &&
        report.ciphertext.length > 0 &&
        report.ciphertext.length <= 200_000
    );
}

export async function POST(request: Request) {
    // Reject cross-origin requests before reading their bodies.
    if (!originIsAllowed(request)) {
        return NextResponse.json(
            { error: "Forbidden request origin." },
            {
                status: 403,
                headers: { "Cache-Control": "no-store" },
            }
        );
    }

    // Reject oversized requests early when Content-Length is supplied.
    const contentLength = request.headers.get("content-length");

    if (contentLength !== null) {
        const size = Number(contentLength);

        if (!Number.isSafeInteger(size) || size < 0) {
            return NextResponse.json(
                { error: "Invalid Content-Length header." },
                { status: 400 }
            );
        }

        if (size > MAX_REQUEST_BYTES) {
            return NextResponse.json(
                { error: "Request body is too large." },
                { status: 413 }
            );
        }
    }

    let body: string;

    try {
        body = await request.text();
    } catch {
        return NextResponse.json(
            { error: "Could not read request body." },
            { status: 400 }
        );
    }

    // Also check the actual body size, including when Content-Length
    // is absent. This is a post-read check, not a streaming size limit.
    if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_BYTES) {
        return NextResponse.json(
            { error: "Request body is too large." },
            { status: 413 }
        );
    }

    let payload: unknown;

    try {
        payload = JSON.parse(body);
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON request." },
            {
                status: 400,
                headers: { "Cache-Control": "no-store" },
            }
        );
    }

    if (!isEncryptedReport(payload)) {
        return NextResponse.json(
            { error: "Invalid encrypted report payload." },
            {
                status: 400,
                headers: { "Cache-Control": "no-store" },
            }
        );
    }

    try {
        const reportId = randomUUID();
        const storageDirectory = path.join(
            process.cwd(),
            "data",
            "reports"
        );

        await mkdir(storageDirectory, {
            recursive: true,
            mode: 0o700,
        });

        await writeFile(
            path.join(storageDirectory, `${reportId}.json`),
            JSON.stringify(payload),
            {
                flag: "wx",
                mode: 0o600,
            }
        );

        return NextResponse.json(
            { reportId, stored: true },
            {
                status: 201,
                headers: { "Cache-Control": "no-store" },
            }
        );
    } catch {
        return NextResponse.json(
            { error: "Could not store the encrypted report." },
            {
                status: 500,
                headers: { "Cache-Control": "no-store" },
            }
        );
    }
}