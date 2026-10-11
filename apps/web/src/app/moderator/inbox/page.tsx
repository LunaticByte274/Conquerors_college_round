
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type StoredReport = {
    reportId: string;
    storedAt: string;
};

type DecryptedReport = {
    reportId: string;
    category: string;
    body: string;
};

export default function ModeratorInboxPage() {
    const router = useRouter();
    const [reports, setReports] = useState<StoredReport[]>([]);
    const [selected, setSelected] = useState<DecryptedReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [openingId, setOpeningId] = useState<string | null>(null);
    const [error, setError] = useState("");

    const loadReports = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const response = await fetch("/api/moderator-session", {
                cache: "no-store",
            });
            const session = await response.json();

            if (!response.ok || !session.authenticated) {
                router.replace("/moderator");
                return;
            }

            const inboxResponse = await fetch("/api/moderator-reports", {
                cache: "no-store",
            });

            if (inboxResponse.status === 401) {
                router.replace("/moderator");
                return;
            }

            const data = await inboxResponse.json();

            if (!inboxResponse.ok) {
                throw new Error(data.error || "Could not load reports.");
            }

            setReports(data.reports);
        } catch {
            setError("Unable to load the report inbox. Please try again.");
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => {
        void loadReports();
    }, [loadReports]);

    async function openReport(reportId: string) {
        setOpeningId(reportId);
        setSelected(null);
        setError("");

        try {
            const response = await fetch("/api/moderator-reports/decrypt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                cache: "no-store",
                body: JSON.stringify({ reportId }),
            });

            const data = await response.json();

            if (response.status === 401) {
                router.replace("/moderator");
                return;
            }

            if (!response.ok) {
                throw new Error(data.error || "Could not decrypt report.");
            }

            setSelected(data as DecryptedReport);
        } catch {
            setError("Could not open this report. Check the server logs.");
        } finally {
            setOpeningId(null);
        }
    }

    async function signOut() {
        try {
            await fetch("/api/moderator-logout", {
                method: "POST",
                cache: "no-store",
            });
        } finally {
            router.replace("/moderator");
        }
    }

    return (
        <main className="min-h-screen bg-[#080b12] px-5 py-10 text-white sm:px-8">
            <div className="mx-auto max-w-6xl">
                <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400">
                            INCOGNITO / MODERATOR
                        </p>
                        <h1 className="mt-2 text-3xl font-bold">
                            Confidential report inbox
                        </h1>
                        <p className="mt-2 text-sm text-gray-400">
                            Reports are decrypted only when you open them.
                        </p>
                    </div>

                    <button
                        onClick={signOut}
                        className="rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/10"
                    >
                        Sign out
                    </button>
                </header>

                {error && (
                    <div
                        role="alert"
                        className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
                    >
                        {error}
                    </div>
                )}

                <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-lg font-semibold">
                                Stored reports
                            </h2>

                            <button
                                onClick={() => void loadReports()}
                                disabled={loading}
                                className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
                            >
                                Refresh
                            </button>
                        </div>

                        {loading ? (
                            <p className="mt-6 text-sm text-gray-400">
                                Loading reports...
                            </p>
                        ) : reports.length === 0 ? (
                            <p className="mt-6 text-sm text-gray-400">
                                No reports found.
                            </p>
                        ) : (
                            <ul className="mt-5 space-y-3">
                                {reports.map((report) => (
                                    <li key={report.reportId}>
                                        <button
                                            onClick={() => void openReport(report.reportId)}
                                            disabled={openingId !== null}
                                            className={`w-full rounded-xl border p-4 text-left transition ${
                                                selected?.reportId === report.reportId
                                                    ? "border-emerald-400/60 bg-emerald-400/10"
                                                    : "border-white/10 bg-black/20 hover:border-white/25"
                                            } disabled:opacity-60`}
                                        >
                                            <span className="block text-sm font-medium">
                                                Report {report.reportId.slice(0, 8)}
                                            </span>
                                            <span className="mt-1 block text-xs text-gray-400">
                                                Stored {new Date(report.storedAt).toLocaleString()}
                                            </span>
                                            <span className="mt-2 block break-all font-mono text-[10px] text-gray-500">
                                                {report.reportId}
                                            </span>
                                            {openingId === report.reportId && (
                                                <span className="mt-2 block text-xs text-emerald-300">
                                                    Decrypting...
                                                </span>
                                            )}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}

                        <p className="mt-5 text-xs leading-5 text-gray-500">
                            The list contains report references and storage
                            timestamps, not report contents.
                        </p>
                    </section>

                    <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                        <h2 className="text-lg font-semibold">
                            Report details
                        </h2>

                        {!selected ? (
                            <p className="mt-6 text-sm leading-6 text-gray-400">
                                Select a report to decrypt and review its
                                contents.
                            </p>
                        ) : (
                            <article className="mt-5">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
                                        Decrypted for review
                                    </span>
                                    <span className="text-xs text-gray-500">
                                        {selected.reportId}
                                    </span>
                                </div>

                                <h3 className="mt-6 text-sm text-gray-400">
                                    Category
                                </h3>
                                <p className="mt-2 font-semibold">
                                    {selected.category}
                                </p>

                                <h3 className="mt-6 text-sm text-gray-400">
                                    Report contents
                                </h3>
                                <p className="mt-2 whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-black/30 p-4 text-sm leading-7 text-gray-200">
                                    {selected.body}
                                </p>

                                <button
                                    onClick={() => setSelected(null)}
                                    className="mt-5 rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/10"
                                >
                                    Close report
                                </button>
                            </article>
                        )}
                    </section>
                </div>
            </div>
        </main>
    );
}

