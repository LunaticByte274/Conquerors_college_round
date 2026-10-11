import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import type { EncryptedReport } from "@/lib/report-encryption";

const MAX_REQUEST_BYTES = 256 * 1024;

function originIsAllowed(request: Request): boolean {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");

    if (!origin || !host) return false;

    try {
        const parsedOrigin = new URL(origin);
        const requestUrl = new URL(request.url);

        return (
            parsedOrigin.origin === requestUrl.origin &&
            parsedOrigin.host === host
        );
    } catch {
        return false;
    }
}

function isEncryptedReport(value: unknown): value is EncryptedReport {
    if (!value || typeof value !== "object") return false;

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
    const noStore = { "Cache-Control": "no-store" };

    if (!originIsAllowed(request)) {
        return NextResponse.json(
            { error: "Forbidden request origin." },
            { status: 403, headers: noStore }
        );
    }

    const contentLength = request.headers.get("content-length");

    if (contentLength !== null) {
        const size = Number(contentLength);

        if (!Number.isSafeInteger(size) || size < 0) {
            return NextResponse.json(
                { error: "Invalid Content-Length header." },
                { status: 400, headers: noStore }
            );
        }

        if (size > MAX_REQUEST_BYTES) {
            return NextResponse.json(
                { error: "Request body is too large." },
                { status: 413, headers: noStore }
            );
        }
    }

    let body: string;

    try {
        body = await request.text();
    } catch {
        return NextResponse.json(
            { error: "Could not read request body." },
            { status: 400, headers: noStore }
        );
    }

    if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_BYTES) {
        return NextResponse.json(
            { error: "Request body is too large." },
            { status: 413, headers: noStore }
        );
    }

    let payload: unknown;

    try {
        payload = JSON.parse(body);
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON request." },
            { status: 400, headers: noStore }
        );
    }

    if (!isEncryptedReport(payload)) {
        return NextResponse.json(
            { error: "Invalid encrypted report payload." },
            { status: 400, headers: noStore }
        );
    }

    try {
        const reportId = randomUUID();

        await put(
            `reports/${reportId}.json`,
            JSON.stringify(payload),
            {
                access: "private",
                contentType: "application/json",
                addRandomSuffix: false,
            }
        );

        return NextResponse.json(
            { reportId, stored: true },
            { status: 201, headers: noStore }
        );
    } catch (error) {
        console.error("Encrypted report storage failed:", error);

        return NextResponse.json(
            { error: "Could not store the encrypted report." },
            { status: 500, headers: noStore }
        );
    }
}
