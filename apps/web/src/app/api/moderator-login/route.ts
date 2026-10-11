
import { NextResponse } from "next/server";
import {
    createModeratorSession,
    verifyModeratorPassword,
} from "@/lib/moderator-auth";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

// Local-demo limiter only; use shared storage in production.
const attempts = new Map<string, { count: number; resetAt: number }>();

function originIsAllowed(request: Request): boolean {
    const origin = request.headers.get("origin");

    // Browser POST requests should include Origin.
    if (!origin) return false;

    try {
        return new URL(origin).host === request.headers.get("host");
    } catch {
        return false;
    }
}

function isRateLimited(key: string): boolean {
    const now = Date.now();
    const entry = attempts.get(key);

    if (!entry || now >= entry.resetAt) {
        attempts.set(key, {
            count: 1,
            resetAt: now + WINDOW_MS,
        });
        return false;
    }

    entry.count += 1;
    return entry.count > MAX_ATTEMPTS;
}

function getClientKey(request: Request): string {
    // For local development only. Do not trust forwarded headers
    // in production unless they are set by a trusted reverse proxy.
    return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || "local-client";
}

export async function POST(request: Request) {
    if (!originIsAllowed(request)) {
        return NextResponse.json(
            { error: "Request origin not allowed." },
            { status: 403, headers: { "Cache-Control": "no-store" } }
        );
    }

    const clientKey = getClientKey(request);

    if (isRateLimited(clientKey)) {
        return NextResponse.json(
            { error: "Too many login attempts. Try again in 15 minutes." },
            {
                status: 429,
                headers: {
                    "Cache-Control": "no-store",
                    "Retry-After": "900",
                },
            }
        );
    }

    let body: unknown;

    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: "Invalid request." },
            { status: 400 }
        );
    }

    if (
        !body ||
        typeof body !== "object" ||
        !("password" in body) ||
        typeof body.password !== "string" ||
        body.password.length === 0 ||
        body.password.length > 1024
    ) {
        return NextResponse.json(
            { error: "Invalid credentials." },
            { status: 400 }
        );
    }

    if (!verifyModeratorPassword(body.password)) {
        return NextResponse.json(
            { error: "Invalid credentials." },
            {
                status: 401,
                headers: { "Cache-Control": "no-store" },
            }
        );
    }

    // Clear the local counter after successful authentication.
    attempts.delete(clientKey);

    try {
        await createModeratorSession();

        return NextResponse.json(
            { authenticated: true },
            { headers: { "Cache-Control": "no-store" } }
        );
    } catch {
        return NextResponse.json(
            { error: "Moderator authentication is not configured." },
            { status: 500 }
        );
    }
}

