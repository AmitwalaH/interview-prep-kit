"use client";

import { useState, FormEvent, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/apiClient";
import { KitDocument } from "@/lib/types";
import { validateKitInput, parseBatchFile, KitFormInput } from "@/lib/kitFormValidation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Card } from "@/components/ui/Card";

type Mode = "single" | "batch";

export default function NewKitPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("single");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-heading text-2xl font-semibold text-ink">Create a prep kit</h1>

      <div className="mt-4 flex w-fit gap-1 rounded-md border border-border bg-surface p-1">
        <button
          onClick={() => setMode("single")}
          className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
            mode === "single" ? "bg-amber text-background" : "text-ink-muted hover:text-ink"
          }`}
        >
          Paste one
        </button>
        <button
          onClick={() => setMode("batch")}
          className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
            mode === "batch" ? "bg-amber text-background" : "text-ink-muted hover:text-ink"
          }`}
        >
          Upload multiple
        </button>
      </div>

      <div className="mt-6">
        {mode === "single" ? (
          <SingleKitForm onCreated={(id) => router.push(`/kits/${id}`)} />
        ) : (
          <BatchUploadForm onCreated={() => router.push("/dashboard")} />
        )}
      </div>
    </div>
  );
}

function SingleKitForm({ onCreated }: { onCreated: (id: string) => void }) {
  const [jd, setJd] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [days, setDays] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const validationError = validateKitInput({ jd, company_url: companyUrl, days });
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const kit = await apiFetch<KitDocument>("/api/kits", {
        method: "POST",
        body: { jd, company_url: companyUrl, days },
      });
      onCreated(kit.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create kit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Textarea
          label="Job description"
          rows={10}
          placeholder="Paste the full job posting text here..."
          value={jd}
          onChange={(e) => setJd(e.target.value)}
        />
        <Input
          label="Company website"
          type="url"
          placeholder="https://company.com"
          value={companyUrl}
          onChange={(e) => setCompanyUrl(e.target.value)}
        />
        <Input
          label="Days until interview"
          type="number"
          min={1}
          max={365}
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        />
        {error && (
          <p role="alert" className="text-sm text-coral">
            {error}
          </p>
        )}
        <Button type="submit" loading={submitting} className="mt-2 w-full">
          Generate kit
        </Button>
      </form>
    </Card>
  );
}

interface BatchProgressItem {
  input: KitFormInput;
  status: "pending" | "done" | "error";
  message?: string;
}

function BatchUploadForm({ onCreated }: { onCreated: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [items, setItems] = useState<BatchProgressItem[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setItems(null);

    const reader = new FileReader();
    reader.onload = () => {
      const { valid, errors } = parseBatchFile(String(reader.result));
      if (errors.length > 0) {
        setParseError(errors.join("; "));
      }
      if (valid.length > 0) {
        setItems(valid.map((input) => ({ input, status: "pending" as const })));
      }
    };
    reader.readAsText(file);
  }

  async function handleSubmitAll() {
    if (!items) return;
    setSubmitting(true);

    // Sequential, not parallel, mirrors the backend's own rate-limit
    // discipline. Firing N requests at once would trigger N simultaneous
    // generation runs, each hammering the same free-tier LLM quota.
    for (let i = 0; i < items.length; i++) {
      try {
        await apiFetch<KitDocument>("/api/kits", { method: "POST", body: items[i].input });
        setItems((prev) => prev!.map((it, idx) => (idx === i ? { ...it, status: "done" as const } : it)));
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed";
        setItems((prev) => prev!.map((it, idx) => (idx === i ? { ...it, status: "error" as const, message } : it)));
      }
    }
    setSubmitting(false);
  }

  return (
    <Card className="p-6">
      <p className="text-sm text-ink-muted">
        Upload a JSON file: an array of <code className="text-ink">{"{ jd, company_url, days }"}</code> objects, one
        per role.
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        onChange={handleFileChange}
        className="mt-4 block w-full text-sm text-ink-muted file:mr-4 file:rounded-md file:border-0 file:bg-surface-raised file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-border"
      />

      {parseError && <p className="mt-3 text-sm text-coral">{parseError}</p>}

      {items && (
        <div className="mt-4 flex flex-col gap-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <span className="truncate text-sm text-ink">{item.input.company_url}</span>
              <span
                className={`text-xs font-medium ${
                  item.status === "done" ? "text-sage" : item.status === "error" ? "text-coral" : "text-ink-faint"
                }`}
              >
                {item.status === "pending" ? "Queued" : item.status === "done" ? "Created" : item.message}
              </span>
            </div>
          ))}
          <Button onClick={handleSubmitAll} loading={submitting} className="mt-2">
            Create {items.length} kit{items.length === 1 ? "" : "s"}
          </Button>
          {!submitting && items.some((i) => i.status === "done") && (
            <Button variant="secondary" onClick={onCreated}>
              Go to dashboard
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
