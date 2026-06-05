"use client";

import { useMemo, useState } from "react";
import { Clipboard, Loader2, Mail, Shield, Target, UserRound } from "lucide-react";
import type { EnquiryRow } from "@/lib/types";
import { ClassificationBadge } from "@/components/tag-badge";
import type { Classification } from "@/lib/constants";

type AnalyzeResult = EnquiryRow;

const MODEL_SUGGESTIONS = [
  "openai/gpt-4o-mini",
  "openai/gpt-4.1-mini",
  "anthropic/claude-3.7-sonnet",
  "google/gemini-2.5-pro-preview",
  "meta-llama/llama-3.3-70b-instruct",
];

export function EnquiryWorkspace({
  initialResult,
  defaultModel,
}: {
  initialResult: AnalyzeResult | null;
  defaultModel: string;
}) {
  const [clientName, setClientName] = useState(initialResult?.client_name ?? "");
  const [clientEmail, setClientEmail] = useState(initialResult?.client_email ?? "");
  const [enquiryText, setEnquiryText] = useState(initialResult?.enquiry_text ?? "");
  const [modelOverride, setModelOverride] = useState(defaultModel);
  const [result, setResult] = useState<AnalyzeResult | null>(initialResult);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confidencePct = useMemo(() => {
    if (!result) return 0;
    return Math.round(result.confidence * 100);
  }, [result]);

  async function handleAnalyze(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!enquiryText.trim()) {
      setError("Please enter a client enquiry before submitting.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/enquiries/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName,
          clientEmail,
          enquiryText,
          modelOverride,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(
          payload?.error ?? "Unable to process the enquiry right now. Please try again.",
        );
      }

      const payload = (await response.json()) as AnalyzeResult;
      setResult(payload);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to process the enquiry right now. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyAllResult() {
    if (!result) return;
    const content = [
      `Classification: ${result.classification}`,
      `Confidence: ${Math.round(result.confidence * 100)}%`,
      `Urgency: ${result.urgency}`,
      "",
      `Summary:\n${result.summary}`,
      "",
      `Recommended Action:\n${result.recommended_action}`,
      "",
      `Suggested Response:\n${result.suggested_response}`,
    ].join("\n");
    await navigator.clipboard.writeText(content);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Client Enquiry</h2>
        <p className="mt-1 text-sm text-slate-600">
          Enter enquiry details and run structured AI analysis.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleAnalyze}>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Client Name (optional)
            </span>
            <input
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="e.g. John Smith"
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Client Email (optional)
            </span>
            <input
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="e.g. john@example.com"
              value={clientEmail}
              onChange={(event) => setClientEmail(event.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              OpenRouter Model
            </span>
            <input
              list="model-suggestions"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              value={modelOverride}
              onChange={(event) => setModelOverride(event.target.value)}
            />
            <datalist id="model-suggestions">
              {MODEL_SUGGESTIONS.map((model) => (
                <option value={model} key={model} />
              ))}
            </datalist>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Enquiry Message</span>
            <textarea
              className="min-h-44 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Paste the full client enquiry..."
              value={enquiryText}
              onChange={(event) => setEnquiryText(event.target.value)}
              maxLength={4000}
            />
            <span className="mt-1 block text-right text-xs text-slate-500">
              {enquiryText.length}/4000
            </span>
          </label>

          {error ? <p className="rounded-xl bg-rose-100 p-3 text-sm text-rose-700">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <Target size={16} />}
            Analyze Enquiry
          </button>

          <p className="flex items-center justify-center gap-2 text-xs text-slate-500">
            <Shield size={14} />
            Results are stored for authenticated staff history and review.
          </p>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">AI Analysis Result</h2>
            <p className="mt-1 text-sm text-slate-600">Classification, confidence, and action plan.</p>
          </div>
          <button
            type="button"
            onClick={copyAllResult}
            disabled={!result}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Clipboard size={14} />
            Copy
          </button>
        </div>

        {!result ? (
          <p className="mt-8 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            Submit an enquiry to generate AI output.
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Classification</p>
                <div className="mt-2">
                  <ClassificationBadge
                    classification={result.classification as Classification}
                  />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Confidence</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{confidencePct}%</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Urgency</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{result.urgency}</p>
              </div>
            </div>

            {result.manual_review ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                This enquiry has low AI confidence and should be manually reviewed.
              </p>
            ) : null}

            <article className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <h3 className="font-semibold text-slate-900">Summary</h3>
              <p className="mt-1 text-sm text-slate-700">{result.summary}</p>
            </article>

            <article className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="font-semibold text-slate-900">Recommended Action</h3>
              <p className="mt-1 text-sm text-slate-700">{result.recommended_action}</p>
            </article>

            <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <h3 className="font-semibold text-slate-900">Suggested Response</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                {result.suggested_response}
              </p>
            </article>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <p className="flex items-center gap-2">
                <UserRound size={13} />
                {result.client_name ?? "Unknown Client"}
              </p>
              <p className="mt-1 flex items-center gap-2">
                <Mail size={13} />
                {result.client_email ?? "No email provided"}
              </p>
              <p className="mt-1">Model used: {result.model_used}</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
