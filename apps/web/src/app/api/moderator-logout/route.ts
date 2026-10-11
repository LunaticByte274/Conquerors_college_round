
import { NextResponse } from "next/server";
import { destroyModeratorSession } from "@/lib/moderator-auth";


export async function POST() {
    await destroyModeratorSession();

    return NextResponse.json(
        { authenticated: false },
        {
            headers: {
                "Cache-Control": "no-store",
            },
        }
    );
}

