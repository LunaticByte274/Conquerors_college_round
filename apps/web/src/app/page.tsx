
"use client";

import { useState } from "react";

const topics = [
  {
    name: "Workplace misconduct",
    description: "Report unethical practices, harassment, or abuse of authority.",
    icon: "◈",
  },
  {
    name: "Academic integrity",
    description: "Raise concerns about unfair practices and academic misconduct.",
    icon: "⌘",
  },
  {
    name: "Institutional concerns",
    description: "Report systemic issues, negligence, or policy violations.",
    icon: "◇",
  },
];

export default function Home() {
  const [selectedTopic, setSelectedTopic] = useState(topics[0].name);
  const [report, setReport] = useState("");

  return (
    <main className="min-h-screen bg-[#08090d] text-white">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <a href="#" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-400/30 bg-violet-500/15 text-xl text-violet-300">
            ◈
          </span>
          <span className="text-xl font-semibold tracking-tight">
            incognito<span className="text-violet-400">.</span>
          </span>
        </a>

        <div className="hidden items-center gap-8 text-sm text-gray-400 sm:flex">
          <a href="#how-it-works" className="hover:text-white">
            How it works
          </a>
          <a href="#report" className="hover:text-white">
            Submit a report
          </a>
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 text-emerald-300">
            Privacy-first reporting
          </span>
        </div>
      </nav>

      <section className="mx-auto grid max-w-7xl gap-12 px-6 pb-20 pt-12 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:pb-28 lg:pt-20">
        <div className="flex flex-col justify-center">
          <div className="mb-7 inline-flex w-fit items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/5 px-4 py-2 text-sm text-violet-200">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Privacy should never be a privilege.
          </div>

          <h1 className="max-w-3xl text-5xl font-semibold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
            Speak up.
            <br />
            <span className="bg-gradient-to-r from-violet-300 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
              Stay unseen.
            </span>
          </h1>

          <p className="mt-7 max-w-xl text-lg leading-8 text-gray-400">
            A new approach to anonymous reporting. Prove you belong without
            revealing who you are. Raise concerns without leaving your identity
            behind.
          </p>

          <div className="mt-9 flex flex-wrap gap-4">
            <a
              href="#report"
              className="rounded-xl bg-violet-500 px-6 py-3.5 font-medium text-white transition hover:bg-violet-400"
            >
              Submit anonymously <span aria-hidden="true">↗</span>
            </a>
            <a
              href="#how-it-works"
              className="rounded-xl border border-white/10 px-6 py-3.5 font-medium text-gray-300 transition hover:bg-white/5"
            >
              Explore the technology
            </a>
          </div>

          <div className="mt-12 grid max-w-xl grid-cols-3 gap-5 border-t border-white/10 pt-7">
            <div>
              <p className="text-sm font-medium text-white">Zero knowledge</p>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                Prove membership privately
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Unlinkable</p>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                Separate topic identities
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Tamper-evident</p>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                Blockchain verification
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center">
          <div
            id="report"
            className="w-full rounded-3xl border border-white/10 bg-[#101117] p-6 shadow-2xl shadow-violet-950/20 sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-violet-300">PRIVATE REPORTING</p>
                <h2 className="mt-2 text-2xl font-semibold">
                  Your voice matters.
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-400">
                  Choose a category and draft your concern.
                </p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/5 text-emerald-300">
                ◈
              </div>
            </div>

            <div className="mt-8">
              <label
                htmlFor="topic"
                className="mb-3 block text-sm font-medium text-gray-300"
              >
                Reporting category
              </label>
              <div className="space-y-3">
                {topics.map((topic) => (
                  <button
                    key={topic.name}
                    type="button"
                    onClick={() => setSelectedTopic(topic.name)}
                    className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${
                      selectedTopic === topic.name
                        ? "border-violet-400/60 bg-violet-500/10"
                        : "border-white/10 bg-white/[0.02] hover:border-white/20"
                    }`}
                  >
                    <span className="mt-0.5 text-lg text-violet-300">
                      {topic.icon}
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-medium">
                        {topic.name}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-gray-500">
                        {topic.description}
                      </span>
                    </span>
                    <span
                      className={`mt-1 h-4 w-4 rounded-full border ${
                        selectedTopic === topic.name
                          ? "border-violet-400 bg-violet-400 ring-2 ring-violet-400/20"
                          : "border-gray-600"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-7">
              <label
                htmlFor="reportText"
                className="mb-3 block text-sm font-medium text-gray-300"
              >
                Describe your concern
              </label>
              <textarea
                id="reportText"
                value={report}
                onChange={(event) => setReport(event.target.value)}
                placeholder="Describe what happened. Avoid including names or details that could identify you..."
                rows={5}
                maxLength={5000}
                className="w-full resize-y rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white outline-none placeholder:text-gray-600 focus:border-violet-400/60"
              />
              <div className="mt-2 flex justify-between text-xs text-gray-500">
                <span>Do not include identifying information.</span>
                <span>{report.length}/5000</span>
              </div>
            </div>

            <button
              type="button"
              disabled={!report.trim()}
              onClick={() =>
                alert(
                  "Interface preview only. No report has been submitted or stored. Cryptographic verification and secure submission will be integrated next."
                )
              }
              className="mt-6 w-full rounded-xl bg-violet-500 px-5 py-4 font-medium text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue to secure submission <span aria-hidden="true">→</span>
            </button>

            <p className="mt-4 text-center text-xs leading-5 text-gray-500">
              Preview only · No report is transmitted or stored
            </p>
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="border-t border-white/10 bg-[#0c0d13] px-6 py-20 lg:px-10"
      >
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-violet-300">
            Built for trust
          </p>
          <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Verify your membership. Never expose your identity.
          </h2>
          <p className="mt-4 max-w-2xl leading-7 text-gray-400">
            Incognito is designed around cryptographic proofs, topic-specific
            duplicate prevention and privacy-conscious report handling.
          </p>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              {
                number: "01",
                title: "Prove, don't reveal",
                text: "Zero-knowledge proofs will verify eligible membership without exposing the member's identity.",
              },
              {
                number: "02",
                title: "Prevent duplicate reports",
                text: "Topic-scoped nullifiers will prevent repeat submissions without creating a global reporter identifier.",
              },
              {
                number: "03",
                title: "Protect sensitive reports",
                text: "Encrypted off-chain storage and carefully restricted access will protect report content.",
              },
            ].map((item) => (
              <article
                key={item.number}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-6"
              >
                <p className="text-sm text-violet-300">{item.number}</p>
                <h3 className="mt-5 text-lg font-semibold">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-gray-400">
                  {item.text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-7 text-center text-xs text-gray-500">
        Incognito · Privacy-preserving anonymous reporting · Hackathon prototype
      </footer>
    </main>
  );
}
