
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function ModeratorLoginPage() {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setLoading(true);

        try {
            const response = await fetch("/api/moderator-login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                cache: "no-store",
                body: JSON.stringify({ password }),
            });

            const data = await response.json();

            if (!response.ok || !data.authenticated) {
                setError(data.error || "Unable to sign in.");
                return;
            }

            setPassword("");
            router.push("/moderator/inbox");
        } catch {
            setError("Unable to connect. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="min-h-screen bg-[#080b12] px-6 py-16 text-white">
            <div className="mx-auto mt-16 max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
                    INCOGNITO
                </p>

                <h1 className="mt-4 text-3xl font-bold">
                    Moderator access
                </h1>

                <p className="mt-3 text-sm leading-6 text-gray-400">
                    Sign in to access the confidential report review area.
                    Access is restricted to authorized moderators.
                </p>

                <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                    <div>
                        <label
                            htmlFor="password"
                            className="mb-2 block text-sm font-medium text-gray-200"
                        >
                            Moderator password
                        </label>

                        <input
                            id="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            maxLength={1024}
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-emerald-400"
                            placeholder="Enter moderator password"
                        />
                    </div>

                    {error && (
                        <p
                            role="alert"
                            className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
                        >
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !password}
                        className="w-full rounded-xl bg-emerald-400 px-4 py-3 font-semibold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {loading ? "Signing in..." : "Sign in securely"}
                    </button>
                </form>

                <p className="mt-6 text-xs leading-5 text-gray-500">
                    Report contents are intended only for authorized review.
                    Never share your moderator credentials.
                </p>
            </div>
        </main>
    );
}

