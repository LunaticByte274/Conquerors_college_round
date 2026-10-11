"use client";

import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import type { BrowserProvider } from "ethers";
import type { Identity } from "@semaphore-protocol/core";
import { encryptReport } from "@/lib/report-encryption";
import WalletConnect from "@/components/WalletConnect";

type Topic = {
  id: number;
  name: string;
  description: string;
  icon: string;
  hint: string;
};

type SubmissionStage = "idle" | "preparing" | "encrypting" | "storing" | "proving" | "success" | "error";

type StoredReportResponse = {
  reportId?: string;
  stored?: boolean;
  error?: string;
};

const topics: Topic[] = [
  {
    id: Number(process.env.NEXT_PUBLIC_TOPIC_WORKPLACE ?? "1"),
    name: "Workplace misconduct",
    description: "Unethical practices, harassment, or abuse of authority.",
    icon: "◈",
    hint: "Describe conduct, dates, locations, and relevant context where safe.",
  },
  {
    id: Number(process.env.NEXT_PUBLIC_TOPIC_ACADEMIC ?? "2"),
    name: "Academic integrity",
    description: "Unfair practices, academic misconduct, or compromised processes.",
    icon: "⌘",
    hint: "Focus on the incident and its impact; avoid unnecessary personal details.",
  },
  {
    id: Number(process.env.NEXT_PUBLIC_TOPIC_INSTITUTIONAL ?? "3"),
    name: "Institutional concerns",
    description: "Systemic issues, negligence, or potential policy violations.",
    icon: "◇",
    hint: "Explain the process or policy involved and what you observed.",
  },
];

const features = [
  {
    number: "01",
    icon: "◎",
    title: "Prove, don’t reveal",
    text: "A Semaphore zero-knowledge proof can demonstrate eligible group membership without placing your identity backup in the report.",
  },
  {
    number: "02",
    icon: "↗",
    title: "Scoped reporting",
    text: "The selected topic determines the configured proof scope. The contract remains responsible for enforcing its nullifier and topic rules.",
  },
  {
    number: "03",
    icon: "⬡",
    title: "Encrypt before storage",
    text: "Report content is encrypted in the browser before the encrypted payload is sent to the storage API.",
  },
];

const MAX_REPORT_LENGTH = 5000;
const MAX_IDENTITY_FILE_BYTES = 128 * 1024;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-violet-300 sm:text-[11px]">
      <span aria-hidden="true" className="h-px w-6 bg-violet-400/80" />
      {children}
    </p>
  );
}

function StepIcon({ children, active = false, complete = false }: {
  children: ReactNode;
  active?: boolean;
  complete?: boolean;
}) {
  return (
    <span
      className={cx(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-xs font-semibold transition-colors",
        complete
          ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
          : active
            ? "border-violet-300/30 bg-violet-400/15 text-violet-200"
            : "border-white/[0.08] bg-white/[0.025] text-gray-500",
      )}
      aria-hidden="true"
    >
      {complete ? "✓" : children}
    </span>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const copy = useCallback(async () => {
    setCopied(false);
    setFailed(false);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setFailed(true);
    }
  }, [value]);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => void copy()}
        className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/[0.09] bg-white/[0.035] px-3 py-2 text-xs font-medium text-gray-300 transition hover:border-violet-300/25 hover:bg-violet-400/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
      >
        <span aria-hidden="true">{copied ? "✓" : "▣"}</span>
        {copied ? "Copied" : `Copy ${label}`}
      </button>
      {failed && (
        <span role="status" className="text-xs text-amber-300">
          Clipboard access unavailable. Select the value above and copy it manually.
        </span>
      )}
    </div>
  );
}

function StageRow({
  number,
  title,
  detail,
  active,
  complete,
}: {
  number: string;
  title: string;
  detail: string;
  active: boolean;
  complete: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <StepIcon active={active} complete={complete}>{number}</StepIcon>
      <div className="min-w-0 flex-1 pb-1">
        <p className={cx("text-sm font-medium", complete ? "text-emerald-200" : active ? "text-white" : "text-gray-500")}>
          {title}
          {active && (
            <span className="ml-2 inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-violet-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300" />
              In progress
            </span>
          )}
        </p>
        <p className="mt-1 text-xs leading-5 text-gray-500">{detail}</p>
      </div>
    </div>
  );
}

export default function Home() {
  const [selectedTopicId, setSelectedTopicId] = useState<number>(topics[0]?.id ?? 1);
  const [report, setReport] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stage, setStage] = useState<SubmissionStage>("idle");
  const [submissionStatus, setSubmissionStatus] = useState("");
  const [reportReference, setReportReference] = useState("");
  const [transactionHash, setTransactionHash] = useState("");
  const [walletProvider, setWalletProvider] = useState<BrowserProvider | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [identityStatus, setIdentityStatus] = useState("");
  const [walletStatus, setWalletStatus] = useState("");
  const [showPrivacyDetails, setShowPrivacyDetails] = useState(false);
  const reportId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === selectedTopicId) ?? topics[0],
    [selectedTopicId],
  );

  const validTopics =
    topics.every((topic) => Number.isSafeInteger(topic.id) && topic.id > 0) &&
    new Set(topics.map((topic) => topic.id)).size === topics.length;
  const canSubmit = Boolean(
    report.trim() &&
    report.trim().length <= MAX_REPORT_LENGTH &&
    !isSubmitting &&
    walletProvider &&
    identity &&
    selectedTopic &&
    validTopics,
  );

  async function handleIdentityFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setIdentityStatus("");
    setIdentity(null);

    if (!file) return;

    if (file.size > MAX_IDENTITY_FILE_BYTES) {
      setIdentityStatus("This file is larger than expected for an identity backup. Choose the original backup file.");
      event.target.value = "";
      return;
    }

    try {
      const exported = await file.text();
      const { importIdentity } = await import("@/lib/identity");
      const restored = importIdentity(exported);
      setIdentity(restored);
      setIdentityStatus("Identity backup loaded locally. Keep this file private.");
      setSubmissionStatus("");
      if (stage === "error") setStage("idle");
    } catch (error) {
      setIdentityStatus(
        error instanceof Error
          ? error.message
          : "Could not load this identity backup. Confirm that it is the original exported backup.",
      );
    } finally {
      // Permit selecting the same file again after a failed import.
      event.target.value = "";
    }
  }

  function resetResult() {
    setSubmissionStatus("");
    setReportReference("");
    setTransactionHash("");
    setStage("idle");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    if (!validTopics || !selectedTopic) {
      setStage("error");
      setSubmissionStatus("Reporting topics are misconfigured. Check the public topic ID environment variables.");
      return;
    }
    if (!report.trim()) {
      setStage("error");
      setSubmissionStatus("Write a short description before submitting.");
      return;
    }
    if (!walletProvider) {
      setStage("error");
      setSubmissionStatus("Connect MetaMask to the configured local Hardhat network first.");
      return;
    }
    if (!identity) {
      setStage("error");
      setSubmissionStatus("Import the original Semaphore identity backup enrolled on this network first.");
      return;
    }

    setIsSubmitting(true);
    setSubmissionStatus("");
    setReportReference("");
    setTransactionHash("");
    setStage("preparing");

    let storedReference = "";

    try {
      const keyResponse = await fetch("/api/moderator-public-key", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (!keyResponse.ok) {
        throw new Error("The moderator public key could not be retrieved. Please try again.");
      }

      const keyData: { publicKey?: string } = await keyResponse.json();
      if (typeof keyData.publicKey !== "string" || !keyData.publicKey.trim()) {
        throw new Error("The moderator public key is unavailable or misconfigured.");
      }

      setStage("encrypting");
      const encryptedPayload = await encryptReport(
        { category: selectedTopic.name, body: report.trim() },
        keyData.publicKey,
      );
      const serializedPayload = JSON.stringify(encryptedPayload);

      setStage("storing");
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: serializedPayload,
      });

      let result: StoredReportResponse;
      try {
        result = await response.json();
      } catch {
        throw new Error("The report-storage service returned an invalid response.");
      }

      if (!response.ok || result.stored !== true || typeof result.reportId !== "string" || !result.reportId) {
        throw new Error(result.error || "The encrypted report could not be stored.");
      }

      storedReference = result.reportId;
      setReportReference(storedReference);

      setStage("proving");
      const { submitAnonymousReport } = await import("@/lib/incognito-chain");
      const submitted = await submitAnonymousReport(
        walletProvider,
        identity,
        serializedPayload,
        BigInt(selectedTopic.id),
      );

      if (!submitted?.transactionHash) {
        throw new Error("The submission helper returned no transaction hash. Verify the transaction status before retrying.");
      }

      setTransactionHash(submitted.transactionHash);
      setStage("success");
      setSubmissionStatus("Your encrypted report was stored and the blockchain transaction was confirmed.");
      setReport("");
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : "An unexpected error occurred.";
      const rejected = /user rejected|user denied|action_rejected/i.test(rawMessage);
      const message = rejected
        ? "The wallet request was cancelled. The encrypted report may already be stored, but the blockchain transaction was not confirmed."
        : rawMessage;

      setStage("error");
      setSubmissionStatus(
        storedReference
          ? `Encrypted report stored. Reference: ${storedReference}. Blockchain submission did not complete: ${message}`
          : message,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const activeStage = stage === "preparing" ? 0
    : stage === "encrypting" ? 1
      : stage === "storing" ? 2
        : stage === "proving" ? 3
          : stage === "success" ? 4 : -1;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08090e] text-white selection:bg-violet-500/30">
      <a
        href="#report"
        className="sr-only z-50 rounded-lg bg-violet-500 px-4 py-3 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to reporting form
      </a>

      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[780px] overflow-hidden">
        <div className="absolute -left-48 top-24 h-[430px] w-[430px] rounded-full bg-violet-700/[0.15] blur-[140px]" />
        <div className="absolute -right-40 top-24 h-[420px] w-[420px] rounded-full bg-indigo-600/[0.12] blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(139,92,246,0.10),transparent_56%)]" />
        <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />
      </div>

      <header className="relative z-10 border-b border-white/[0.07]">
        <nav aria-label="Main navigation" className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
          <a href="#top" className="group inline-flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-300/20 bg-violet-400/10 text-xl text-violet-200 shadow-lg shadow-violet-950/30 transition group-hover:border-violet-300/40">◈</span>
            <span className="text-xl font-semibold tracking-tight">incognito<span className="text-violet-400">.</span></span>
            <span className="hidden border-l border-white/10 pl-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500 sm:inline">Private reporting</span>
          </a>
          <div className="flex items-center gap-4 text-sm text-gray-400 sm:gap-7">
            <a href="#how-it-works" className="hidden rounded-md transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 sm:inline">How it works</a>
            <a href="#report" className="rounded-lg border border-violet-300/20 bg-violet-400/[0.08] px-3.5 py-2.5 font-medium text-violet-100 transition hover:bg-violet-400/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 sm:px-4">Submit a report <span aria-hidden="true">↗</span></a>
          </div>
        </nav>
      </header>

      <section id="top" className="relative z-10 mx-auto grid max-w-[1440px] items-start gap-12 px-5 pb-20 pt-12 sm:px-8 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(440px,0.88fr)] lg:gap-16 lg:px-12 lg:pb-28 lg:pt-20 xl:gap-24">
        <div className="lg:sticky lg:top-10">
          <div className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-violet-300/20 bg-violet-400/[0.06] px-4 py-2.5 text-xs font-medium text-violet-100 sm:text-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-30 motion-reduce:animate-none" />
              <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Privacy should never be a privilege.
          </div>

          <h1 className="max-w-3xl text-5xl font-semibold leading-[1.04] tracking-[-0.055em] sm:text-6xl lg:text-7xl xl:text-[84px]">
            Speak up.
            <br />
            <span className="bg-gradient-to-r from-violet-300 via-purple-400 to-indigo-300 bg-clip-text text-transparent">Stay unseen.</span>
          </h1>
          <p className="mt-7 max-w-xl text-base leading-8 text-gray-400 sm:text-lg">
            Raise a concern through an encrypted workflow designed to separate a report from the identity used to prove group membership.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#report" className="group inline-flex min-h-12 items-center gap-3 rounded-xl bg-violet-500 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-950/30 transition hover:-translate-y-0.5 hover:bg-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#08090e] sm:px-6">
              Start a private report <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">↗</span>
            </a>
            <a href="#how-it-works" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.025] px-5 py-3.5 text-sm font-medium text-gray-300 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
              Explore the technology <span aria-hidden="true">↓</span>
            </a>
          </div>

          <div className="mt-12 grid max-w-xl grid-cols-3 gap-4 border-t border-white/[0.08] pt-7 sm:mt-16 sm:gap-7">
            {[
              { value: "01", title: "Zero knowledge", text: "Prove membership privately" },
              { value: "02", title: "Browser encryption", text: "Encrypt before storage" },
              { value: "03", title: "On-chain proof", text: "Verifiable submission" },
            ].map((item) => (
              <div key={item.value}>
                <p className="font-mono text-xs text-violet-300">{item.value}</p>
                <p className="mt-3 text-xs font-semibold text-gray-200 sm:text-sm">{item.title}</p>
                <p className="mt-2 text-xs leading-5 text-gray-500">{item.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 hidden max-w-xl rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 lg:block">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/[0.08] text-lg text-emerald-300">⬡</span>
              <div>
                <p className="text-sm font-medium text-gray-200">Privacy by design, not by promise</p>
                <p className="mt-1 text-xs leading-5 text-gray-500">Your identity backup is read locally. It should never be shared or uploaded. Public blockchain metadata may still be observable.</p>
              </div>
            </div>
          </div>
        </div>

        <div id="report" className="scroll-mt-6 rounded-[28px] border border-white/[0.10] bg-[#101117]/95 p-5 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-7 lg:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Eyebrow>Private reporting</Eyebrow>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Your voice matters.</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-gray-400">Share what happened. Keep your report encrypted.</p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-400/[0.08] text-xl text-violet-200">◈</div>
          </div>

          <form className="mt-7" onSubmit={(event) => void handleSubmit(event)} noValidate>
            <section aria-labelledby="setup-heading" className="rounded-2xl border border-white/[0.08] bg-black/20 p-4 sm:p-5">
              <h3 id="setup-heading" className="sr-only">Submission setup</h3>
              <div className="flex items-start gap-3">
                <StepIcon complete={Boolean(walletProvider)}>01</StepIcon>
                <div className="min-w-0 flex-1">
                  <p className="pt-1 text-sm font-medium text-gray-100">Connect your wallet</p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">Use MetaMask on the configured local Hardhat network.</p>
                  <div className="mt-3">
                    <WalletConnect
                      onConnected={(provider) => {
                        setWalletProvider(provider);
                        setWalletStatus("Wallet connected. Confirm the network shown in MetaMask.");
                        setSubmissionStatus("");
                        if (stage === "error") setStage("idle");
                      }}
                    />
                  </div>
                  {walletStatus && <p role="status" className="mt-2 text-xs leading-5 text-emerald-300">{walletStatus}</p>}
                </div>
              </div>

              <div className="my-5 border-t border-white/[0.07]" />

              <div className="flex items-start gap-3">
                <StepIcon complete={Boolean(identity)}>02</StepIcon>
                <div className="min-w-0 flex-1">
                  <p className="pt-1 text-sm font-medium text-gray-100">Load your enrolled identity</p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">Choose the original Semaphore identity backup enrolled in this deployment.</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".backup,.txt,text/plain,application/json"
                    onChange={handleIdentityFile}
                    disabled={isSubmitting}
                    className="sr-only"
                    aria-label="Choose Semaphore identity backup"
                  />
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-3 text-sm font-medium text-gray-200 transition hover:border-violet-400/40 hover:bg-violet-400/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span aria-hidden="true" className="text-violet-300">↑</span>
                    {identity ? "Choose a different backup" : "Choose identity backup"}
                  </button>
                  {identityStatus && (
                    <p role="status" aria-live="polite" className={cx("mt-2 text-xs leading-5", identity ? "text-emerald-300" : "text-amber-300")}>
                      <span aria-hidden="true">{identity ? "✓ " : "• "}</span>{identityStatus}
                    </p>
                  )}
                  <p className="mt-2 text-[11px] leading-5 text-gray-600">The selected file is read by this browser component; it is not sent by the file picker.</p>
                </div>
              </div>
            </section>

            <div className="mt-7">
              <div className="mb-3 flex items-center justify-between gap-3">
                <label className="text-sm font-medium text-gray-200" htmlFor={`${reportId}-category`}>Reporting category</label>
                <span className="text-[11px] text-gray-500">Choose one</span>
              </div>
              <div id={`${reportId}-category`} role="group" aria-label="Reporting category" className="space-y-2.5">
                {topics.map((topic) => {
                  const selected = selectedTopicId === topic.id;
                  return (
                    <button
                      key={`${topic.name}-${topic.id}`}
                      type="button"
                      disabled={isSubmitting}
                      aria-pressed={selected}
                      onClick={() => {
                        setSelectedTopicId(topic.id);
                        resetResult();
                      }}
                      className={cx(
                        "group flex min-h-[82px] w-full items-start gap-3.5 rounded-2xl border p-4 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-60 sm:gap-4 sm:p-4",
                        selected
                          ? "border-violet-400/50 bg-violet-500/[0.09] shadow-lg shadow-violet-950/10"
                          : "border-white/[0.08] bg-white/[0.015] hover:border-white/20 hover:bg-white/[0.035]",
                      )}
                    >
                      <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg transition", selected ? "bg-violet-400/15 text-violet-200" : "bg-white/[0.04] text-gray-400 group-hover:text-violet-300")}>{topic.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-gray-100">{topic.name}</span>
                        <span className="mt-1 block text-xs leading-5 text-gray-500">{topic.description}</span>
                      </span>
                      <span className={cx("mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", selected ? "border-violet-300 bg-violet-400 text-[#101117]" : "border-gray-600 text-transparent")}>
                        {selected && <span aria-hidden="true" className="text-[11px] font-bold">✓</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
              {selectedTopic && <p className="mt-2 text-xs leading-5 text-gray-500">{selectedTopic.hint}</p>}
              {!validTopics && <p role="alert" className="mt-2 text-xs leading-5 text-rose-300">Topic configuration is invalid. Check NEXT_PUBLIC_TOPIC_WORKPLACE, NEXT_PUBLIC_TOPIC_ACADEMIC, and NEXT_PUBLIC_TOPIC_INSTITUTIONAL.</p>}
            </div>

            <div className="mt-7">
              <div className="mb-3 flex items-center justify-between gap-3">
                <label htmlFor={`${reportId}-body`} className="text-sm font-medium text-gray-200">Describe your concern</label>
                <span className="text-[11px] text-gray-500">Encrypted before storage</span>
              </div>
              <textarea
                id={`${reportId}-body`}
                value={report}
                onChange={(event) => {
                  setReport(event.target.value);
                  if (stage === "error") {
                    setStage("idle");
                    setSubmissionStatus("");
                  }
                }}
                placeholder="Describe what happened. Include relevant facts and context, but avoid names or details that could identify you unnecessarily…"
                rows={6}
                maxLength={MAX_REPORT_LENGTH}
                disabled={isSubmitting}
                required
                aria-describedby={`${reportId}-help ${reportId}-count`}
                className="w-full resize-y rounded-2xl border border-white/10 bg-black/25 p-4 text-sm leading-7 text-white outline-none transition placeholder:text-gray-600 focus:border-violet-400/50 focus:ring-4 focus:ring-violet-400/[0.06] disabled:opacity-60 sm:p-5"
              />
              <div className="mt-2 flex items-start justify-between gap-4 text-xs text-gray-500">
                <p id={`${reportId}-help`} className="leading-5">Stick to facts. Avoid unnecessary identifying details.</p>
                <p id={`${reportId}-count`} className={cx("shrink-0 tabular-nums", report.length > MAX_REPORT_LENGTH * 0.9 && "text-amber-300")}>{report.length.toLocaleString()}/{MAX_REPORT_LENGTH}</p>
              </div>
            </div>

            {isSubmitting && (
              <div className="mt-6 rounded-2xl border border-violet-300/15 bg-violet-400/[0.035] p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">Secure submission in progress</p>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300">Step {Math.max(1, activeStage + 1)} of 4</span>
                </div>
                <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]" role="progressbar" aria-label="Submission progress" aria-valuemin={0} aria-valuemax={4} aria-valuenow={Math.max(0, activeStage)}>
                  <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-indigo-400 transition-all duration-500" style={{ width: `${Math.max(8, (activeStage / 4) * 100)}%` }} />
                </div>
                <div className="space-y-4">
                  <StageRow number="01" title="Prepare request" detail="Validate the selected topic and retrieve the moderator public key." active={stage === "preparing"} complete={activeStage > 0} />
                  <StageRow number="02" title="Encrypt in browser" detail="Encrypt report contents before sending the payload to the storage API." active={stage === "encrypting"} complete={activeStage > 1} />
                  <StageRow number="03" title="Store encrypted payload" detail="Save the encrypted payload and receive a reference ID." active={stage === "storing"} complete={activeStage > 2} />
                  <StageRow number="04" title="Generate proof & confirm transaction" detail="The submission helper generates the Semaphore proof, requests a wallet transaction, and waits for confirmation." active={stage === "proving"} complete={false} />
                </div>
                <p className="mt-4 border-t border-white/[0.07] pt-3 text-[11px] leading-5 text-gray-500">Proof generation, wallet approval, and receipt waiting are handled by one helper, so the interface does not claim to observe those internal sub-stages separately.</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !report.trim() || !walletProvider || !identity || !validTopics}
              className="group mt-6 flex min-h-[52px] w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-violet-500 to-violet-600 px-5 py-4 text-sm font-semibold text-white shadow-lg shadow-violet-950/30 transition duration-200 hover:-translate-y-0.5 hover:from-violet-400 hover:to-violet-500 hover:shadow-violet-900/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101117] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
            >
              {isSubmitting ? (
                <>
                  <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />
                  {stage === "preparing" ? "Preparing secure request…" : stage === "encrypting" ? "Encrypting report…" : stage === "storing" ? "Storing encrypted payload…" : "Generating proof & submitting…"}
                </>
              ) : (
                <>Encrypt and submit report <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span></>
              )}
            </button>
            {(!walletProvider || !identity) && (
              <p className="mt-3 text-center text-xs leading-5 text-gray-500">
                {!walletProvider && !identity
                  ? "Connect your wallet and load your enrolled identity to continue."
                  : !walletProvider
                    ? "Connect your wallet to enable submission."
                    : "Load your enrolled identity to enable submission."}
              </p>
            )}
          </form>

          {stage === "success" && (
            <div role="status" aria-live="polite" className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.045] p-5">
              <div className="flex items-start gap-3">
                <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-lg text-emerald-300">✓</span>
                <div>
                  <p className="font-semibold text-emerald-300">Report submitted</p>
                  <p className="mt-1 text-xs leading-5 text-gray-400">{submissionStatus}</p>
                </div>
              </div>
              <div className="mt-5 space-y-4">
                <div>
                  <p className="text-xs font-medium text-gray-400">Transaction hash</p>
                  <p className="mt-2 break-all rounded-lg border border-white/[0.06] bg-black/20 p-3 font-mono text-xs leading-5 text-gray-300">{transactionHash}</p>
                  <CopyButton value={transactionHash} label="transaction hash" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-400">Private storage reference</p>
                  <p className="mt-2 break-all rounded-lg border border-white/[0.06] bg-black/20 p-3 font-mono text-xs leading-5 text-gray-300">{reportReference}</p>
                  <CopyButton value={reportReference} label="reference ID" />
                </div>
              </div>
              <button type="button" onClick={resetResult} className="mt-5 rounded-lg px-1 py-2 text-xs font-medium text-violet-300 transition hover:text-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">Start another report ↗</button>
            </div>
          )}

          {stage === "error" && submissionStatus && (
            <div role="alert" aria-live="assertive" className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/[0.045] p-4">
              <div className="flex items-start gap-3">
                <span aria-hidden="true" className="mt-0.5 text-base text-rose-300">!</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-rose-200">{reportReference ? "Report stored; transaction needs attention" : "Submission could not be completed"}</p>
                  <p className="mt-1 break-words text-xs leading-6 text-rose-100/80">{submissionStatus}</p>
                  {reportReference && (
                    <div className="mt-3 rounded-xl border border-white/[0.07] bg-black/20 p-3">
                      <p className="text-[11px] font-medium text-gray-400">Keep this storage reference</p>
                      <p className="mt-2 break-all font-mono text-xs text-gray-300">{reportReference}</p>
                      <CopyButton value={reportReference} label="reference ID" />
                    </div>
                  )}
                  <p className="mt-3 text-[11px] leading-5 text-gray-500">If a transaction may have been submitted, check the wallet and transaction status before retrying to avoid duplicate attempts.</p>
                  <button type="button" onClick={() => { setSubmissionStatus(""); setStage("idle"); }} className="mt-2 rounded-lg py-2 text-xs font-medium text-violet-300 transition hover:text-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">Dismiss message</button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 border-t border-white/[0.07] pt-5">
            <button
              type="button"
              aria-expanded={showPrivacyDetails}
              onClick={() => setShowPrivacyDetails((current) => !current)}
              className="flex w-full items-center justify-between gap-3 rounded-lg text-left text-xs font-medium text-gray-300 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="text-violet-300">ⓘ</span> Important privacy & prototype limitations</span>
              <span aria-hidden="true" className={cx("text-gray-500 transition-transform", showPrivacyDetails && "rotate-180")}>⌄</span>
            </button>
            {showPrivacyDetails && (
              <div className="mt-3 space-y-2 rounded-xl border border-white/[0.07] bg-black/20 p-4 text-xs leading-6 text-gray-500">
                <p>Report content is encrypted in the browser before it is sent to the storage API. This UI does not upload the selected identity backup.</p>
                <p>Wallet addresses, transaction hashes, timing, and other transaction metadata can remain visible on the configured blockchain. A zero-knowledge proof does not make all activity untraceable.</p>
                <p>This hackathon prototype uses configured local infrastructure and is not a production anonymous-reporting service. Do not submit urgent safety concerns or sensitive real-world allegations unless the deployment, storage, access controls, threat model, and recovery procedures have been independently reviewed.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="relative z-10 border-t border-white/[0.07] bg-[#0b0c12] px-5 py-20 sm:px-8 sm:py-24 lg:px-12">
        <div className="mx-auto max-w-[1440px]">
          <div className="max-w-2xl">
            <Eyebrow>Built for trust</Eyebrow>
            <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Speak freely.
              <br />
              <span className="text-gray-500">Reveal only what is necessary.</span>
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-gray-400 sm:text-base">Incognito combines browser-side report encryption, Semaphore membership proofs, and an on-chain submission workflow to demonstrate privacy-preserving reporting.</p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {features.map((feature) => (
              <article key={feature.number} className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 transition duration-200 hover:-translate-y-1 hover:border-violet-400/25 hover:bg-violet-400/[0.025] motion-reduce:transition-none sm:p-7">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-300/15 bg-violet-400/[0.07] text-xl text-violet-300 transition group-hover:bg-violet-400/15">{feature.icon}</span>
                  <span className="font-mono text-xs text-gray-600">{feature.number}</span>
                </div>
                <h3 className="mt-7 text-lg font-semibold text-gray-100">{feature.title}</h3>
                <p className="mt-3 text-sm leading-7 text-gray-400">{feature.text}</p>
              </article>
            ))}
          </div>

          <div className="mt-10 flex flex-col justify-between gap-5 rounded-2xl border border-violet-300/15 bg-gradient-to-r from-violet-500/[0.08] via-transparent to-indigo-500/[0.06] p-6 sm:flex-row sm:items-center sm:p-8">
            <div>
              <p className="text-lg font-semibold">Ready to raise a concern?</p>
              <p className="mt-2 text-sm leading-6 text-gray-400">Complete the setup above, then submit your encrypted report.</p>
            </div>
            <a href="#report" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-3 rounded-xl border border-violet-300/20 bg-violet-400/10 px-5 py-3 text-sm font-medium text-violet-200 transition hover:bg-violet-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">Go to reporting form <span aria-hidden="true">↑</span></a>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/[0.06] px-5 py-7 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <a href="#top" className="flex w-fit items-center gap-2 text-sm font-semibold text-gray-300"><span aria-hidden="true" className="text-violet-300">◈</span> incognito<span className="-ml-2 text-violet-400">.</span></a>
          <p>Privacy-preserving reporting prototype · Hackathon project</p>
          <a href="#how-it-works" className="w-fit transition hover:text-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">How it works ↑</a>
        </div>
      </footer>
    </main>
  );
}
