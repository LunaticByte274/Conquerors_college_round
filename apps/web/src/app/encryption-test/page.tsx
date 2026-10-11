"use client";

import { useState } from "react";
import { encryptReport } from "@/lib/report-encryption";

export default function EncryptionTestPage() {
  const [status, setStatus] = useState("Ready to test");

  async function runTest() {
    try {
      setStatus("Fetching moderator public key...");

      const keyResponse = await fetch("/api/moderator-public-key", {
        cache: "no-store",
      });

      if (!keyResponse.ok) {
        throw new Error(`Public key API failed: ${keyResponse.status}`);
      }

      const { publicKey } = await keyResponse.json();

      setStatus("Encrypting sample report...");

      const encrypted = await encryptReport(
        {
          category: "Test",
          body: "SAMPLE REPORT - fictional test content only",
        },
        publicKey
      );

      setStatus("Submitting encrypted report...");

      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(encrypted),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? `Submission failed: ${response.status}`);
      }

      setStatus(
        `SUCCESS: Encrypted report stored.\nReport ID: ${result.reportId}`
      );
    } catch (error) {
      setStatus(
        `FAILED: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 p-8 text-white">
      <div className="mx-auto max-w-xl space-y-5">
        <h1 className="text-2xl font-bold">Incognito Encryption Test</h1>
        <p className="text-neutral-400">
          Uses fictional test content to verify browser encryption and API storage.
        </p>
        <button
          onClick={runTest}
          className="rounded-lg bg-violet-600 px-5 py-3 font-semibold hover:bg-violet-500"
        >
          Encrypt and Submit Test Report
        </button>
        <pre className="whitespace-pre-wrap break-words rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          {status}
        </pre>
      </div>
    </main>
  );
}
