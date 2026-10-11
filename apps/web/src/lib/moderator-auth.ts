
import "server-only";

import { timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "incognito_moderator_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 8;

function getSessionSecret(): Uint8Array {
    const secret = process.env.MODERATOR_SESSION_SECRET;

    if (!secret || secret.length < 32) {
        throw new Error(
            "MODERATOR_SESSION_SECRET must contain at least 32 characters."
        );
    }

    return new TextEncoder().encode(secret);
}

export function verifyModeratorPassword(password: string): boolean {
    const configuredPassword = process.env.MODERATOR_PASSWORD;

    if (
        !configuredPassword ||
        typeof password !== "string" ||
        password.length === 0 ||
        password.length > 1024
    ) {
        return false;
    }

    const supplied = Buffer.from(password, "utf8");
    const expected = Buffer.from(configuredPassword, "utf8");

    if (supplied.length !== expected.length) {
        return false;
    }

    return timingSafeEqual(supplied, expected);
}

export async function createModeratorSession(): Promise<void> {
    const secret = getSessionSecret();

    const token = await new SignJWT({ role: "moderator" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setIssuer("incognito")
        .setAudience("incognito-moderator")
        .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
        .sign(secret);

    const cookieStore = await cookies();

    cookieStore.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: SESSION_DURATION_SECONDS,
    });
}

export async function isModeratorAuthenticated(): Promise<boolean> {
    const token = (await cookies()).get(COOKIE_NAME)?.value;

    if (!token) {
        return false;
    }

    try {
        const { payload } = await jwtVerify(token, getSessionSecret(), {
            issuer: "incognito",
            audience: "incognito-moderator",
            algorithms: ["HS256"],
        });

        return payload.role === "moderator";
    } catch {
        return false;
    }
}

export async function destroyModeratorSession(): Promise<void> {
    const cookieStore = await cookies();

    cookieStore.set(COOKIE_NAME, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 0,
    });
}

