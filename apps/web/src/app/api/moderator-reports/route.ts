
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { isModeratorAuthenticated } from "@/lib/moderator-auth";


export async function GET() {
    if (!(await isModeratorAuthenticated())) {
        return NextResponse.json(
            { error: "Authentication required." },
            {
                status: 401,
                headers: { "Cache-Control": "no-store" },
            }
        );
    }

    try {
        const directory = path.join(process.cwd(), "data", "reports");
        const files = await readdir(directory, { withFileTypes: true });

        const reports = await Promise.all(
            files
                .filter(
                    (file) =>
                        file.isFile() &&
                        /^[0-9a-f-]{36}\.json$/i.test(file.name)
                )
                .map(async (file) => {
                    const reportId = file.name.slice(0, -5);

                    const raw = await readFile(
                        path.join(directory, file.name),
                        "utf8"
                    );

                    const payload: unknown = JSON.parse(raw);

                    if (
                        !payload ||
                        typeof payload !== "object" ||
                        !("version" in payload) ||
                        payload.version !== 1 ||
                        !("wrappedKey" in payload) ||
                        typeof payload.wrappedKey !== "string" ||
                        !("iv" in payload) ||
                        typeof payload.iv !== "string" ||
                        !("ciphertext" in payload) ||
                        typeof payload.ciphertext !== "string"
                    ) {
                        return null;
                    }

                    const stats = await import("node:fs/promises").then(
                        ({ stat }) =>
                            stat(path.join(directory, file.name))
                    );

                    return {
                        reportId,
                        storedAt: stats.mtime.toISOString(),
                    };
                })
        );

        const validReports = reports
            .filter((report) => report !== null)
            .sort((a, b) => b.storedAt.localeCompare(a.storedAt));

        return NextResponse.json(
            { reports: validReports },
            { headers: { "Cache-Control": "no-store" } }
        );
    } catch {
        return NextResponse.json(
            { error: "Could not load reports." },
            {
                status: 500,
                headers: { "Cache-Control": "no-store" },
            }
        );
    }
}

