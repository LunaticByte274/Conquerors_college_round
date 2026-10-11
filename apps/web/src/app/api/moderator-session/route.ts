
import { NextResponse } from "next/server";
import { isModeratorAuthenticated } from "@/lib/moderator-auth";


export async function GET() {
    const authenticated = await isModeratorAuthenticated();

    return NextResponse.json(
        { authenticated },
        {
            headers: {
                "Cache-Control": "no-store",
            },
        }
    );
}

