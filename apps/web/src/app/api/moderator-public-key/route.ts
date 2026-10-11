import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";


export async function GET() {
    try {
        const publicKeyPath = path.join(
            process.cwd(),
            "keys",
            "moderator-public.pem"
        );

        const publicKey = await readFile(publicKeyPath, "utf8");

        return NextResponse.json(
            { publicKey },
            { headers: { "Cache-Control": "no-store" } }
        );
    } catch {
        return NextResponse.json(
            { error: "Moderator public key is not configured." },
            { status: 503 }
        );
    }
}
