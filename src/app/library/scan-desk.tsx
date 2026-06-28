"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { issueBook, returnBook } from "./actions";

type Loan = {
  id: string;
  issued_at: string;
  due_date: string | null;
  students: { id: string; full_name: string; section: string | null; classes: { display_name: string } | null } | null;
};
type BookHit = {
  id: string;
  code: string;
  title: string;
  author: string | null;
  category: string | null;
  status: string;
  loan: Loan | null;
};
type Lookup = { books: BookHit[] };
type StudentHit = { id: string; full_name: string; admission_no: string | null; class: string; openLoans: number };

// html5-qrcode is loaded lazily so it never runs during SSR.
type Scanner = { start: (a: unknown, b: unknown, c: (t: string) => void, d: () => void) => Promise<void>; stop: () => Promise<void>; clear: () => void };

export default function ScanDesk() {
  const router = useRouter();
  const t = useT();
  const [code, setCode] = useState("");
  // Candidate books from the last lookup, and the one the operator picked.
  // A bare accession number can match several books (codes overlap across
  // registers), so we resolve to a single `selected` before issuing.
  const [results, setResults] = useState<BookHit[]>([]);
  const [selected, setSelected] = useState<BookHit | null>(null);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [studentQuery, setStudentQuery] = useState("");
  const [students, setStudents] = useState<StudentHit[]>([]);

  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Scanner | null>(null);

  const codeInputRef = useRef<HTMLInputElement>(null);

  const doLookup = useCallback(async (raw: string) => {
    const q = raw.trim();
    if (!q) return;
    setBusy(true);
    setMsg(null);
    setSelected(null);
    try {
      const res = await fetch(`/api/library/lookup?code=${encodeURIComponent(q)}`);
      const data = (await res.json()) as Lookup;
      const books = data.books ?? [];
      setResults(books);
      setSearched(true);
      // Exactly one match → jump straight to it; otherwise let the operator pick.
      if (books.length === 1) setSelected(books[0]);
    } catch {
      setMsg({ kind: "err", text: "Lookup failed." });
    } finally {
      setBusy(false);
    }
  }, []);

  const stopScan = useCallback(async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    setScanning(false);
    if (s) {
      try {
        await s.stop();
        s.clear();
      } catch {
        /* already stopped */
      }
    }
  }, []);

  const startScan = useCallback(async () => {
    setMsg(null);
    setScanning(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader") as unknown as Scanner;
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 220 },
        (decoded: string) => {
          // The label QR encodes the full code (e.g. "SAN-4525") — use it as-is.
          const value = decoded.trim();
          setCode(value);
          stopScan();
          doLookup(value);
        },
        () => {}
      );
    } catch {
      setScanning(false);
      setMsg({ kind: "err", text: "Could not start the camera. Type the code instead." });
    }
  }, [doLookup, stopScan]);

  const searchStudents = useCallback(async (q: string) => {
    setStudentQuery(q);
    if (q.trim().length < 1) {
      setStudents([]);
      return;
    }
    try {
      const res = await fetch(`/api/library/students?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      setStudents(json.students ?? []);
    } catch {
      setStudents([]);
    }
  }, []);

  const reset = () => {
    setCode("");
    setResults([]);
    setSelected(null);
    setSearched(false);
    setStudents([]);
    setStudentQuery("");
    // Keep the desk ready for the next book without forcing another click.
    codeInputRef.current?.focus();
  };

  const onIssue = async (studentId: string) => {
    if (!selected) return;
    setBusy(true);
    const r = await issueBook(selected.code, studentId);
    setBusy(false);
    if (r.error) setMsg({ kind: "err", text: r.error });
    else {
      setMsg({ kind: "ok", text: r.message ?? "Issued." });
      reset();
      router.refresh();
    }
  };

  const onReturn = async () => {
    if (!selected) return;
    setBusy(true);
    const r = await returnBook(selected.code);
    setBusy(false);
    if (r.error) setMsg({ kind: "err", text: r.error });
    else {
      setMsg({ kind: "ok", text: r.message ?? "Collected." });
      reset();
      router.refresh();
    }
  };

  const loan = selected?.loan ?? null;

  return (
    <div className="card p-5">
      <p className="mb-3 text-sm text-stone-500">
        {t("Type or scan the book’s number, code, or title and press")}{" "}
        <kbd className="rounded border border-stone-300 bg-stone-50 px-1.5 py-0.5 font-mono text-xs">Enter</kbd>.{" "}
        {t("We’ll figure out if it needs to be issued or collected.")}
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          doLookup(code);
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <input
          ref={codeInputRef}
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t("Book number, code, or title")}
          className="w-64 rounded-lg border border-stone-300 bg-white px-3 py-2 text-base font-mono tracking-wider outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
        />
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="rounded-lg bg-stone-900 px-5 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
        >
          {busy ? t("Looking up…") : t("Look up")}
        </button>
        {scanning ? (
          <button type="button" onClick={stopScan} className="rounded-lg border border-stone-200 px-4 py-2 text-sm">
            {t("Stop camera")}
          </button>
        ) : (
          <button type="button" onClick={startScan} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            {t("📷 Scan QR")}
          </button>
        )}
      </form>

      <div id="qr-reader" className={scanning ? "mt-4 max-w-sm overflow-hidden rounded-lg border border-stone-200" : "hidden"} />

      {msg && (
        <p className={"mt-3 text-sm " + (msg.kind === "ok" ? "text-green-700" : "text-red-600")}>{t(msg.text)}</p>
      )}

      {/* Multiple matches → operator picks the exact copy. */}
      {!selected && results.length > 1 && (
        <div className="mt-4">
          <div className="mb-2 text-sm font-medium text-stone-700">
            {t("{count} matches — pick the right book:", { count: results.length })}
          </div>
          <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
            {results.map((b) => (
              <li key={b.id}>
                <button
                  onClick={() => setSelected(b)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-stone-50"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-stone-800">{b.title}</div>
                    <div className="text-xs text-stone-500">
                      <span className="font-mono">{b.code}</span>
                      {b.category ? ` · ${b.category}` : ""}
                    </div>
                  </div>
                  {b.loan ? (
                    <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{t("Issued")}</span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">{t("Available")}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Resolved single book → issue or collect. */}
      {selected && (
        <div className="mt-4 rounded-lg border border-stone-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold text-stone-900">{selected.title}</div>
              <div className="text-sm text-stone-500">
                <span className="font-mono">{selected.code}</span>
                {selected.author ? ` · ${selected.author}` : ""}
              </div>
            </div>
            {loan ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{t("Issued")}</span>
            ) : (
              <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">{t("Available")}</span>
            )}
          </div>

          {/* Book is currently issued → only thing to do is collect it back. */}
          {loan && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-stone-600">
                {t("Held by")} <strong>{loan.students?.full_name ?? "—"}</strong>
                {loan.students?.classes?.display_name
                  ? ` (${loan.students.classes.display_name}${loan.students.section ? ` · ${loan.students.section}` : ""})`
                  : ""}
                {loan.due_date ? ` · due ${loan.due_date}` : ""}
              </div>
              <button
                onClick={onReturn}
                disabled={busy}
                className="rounded-lg bg-stone-900 px-5 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
              >
                {t("↩ Collect book")}
              </button>
            </div>
          )}

          {/* Book is on the shelf → ready to issue to a student. */}
          {!loan && selected.status === "active" && (
            <div className="mt-4">
              <div className="mb-2 text-sm font-medium text-stone-700">{t("Issue to student")}</div>
              <input
                value={studentQuery}
                onChange={(e) => searchStudents(e.target.value)}
                placeholder={t("Search student by name or admission no.…")}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
              />
              {students.length > 0 && (
                <ul className="mt-2 divide-y divide-stone-100 rounded-lg border border-stone-200">
                  {students.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-stone-800">{s.full_name}</div>
                        <div className="text-xs text-stone-500">
                          {s.class}
                          {s.admission_no ? ` · ${s.admission_no}` : ""} · holds {s.openLoans}
                        </div>
                      </div>
                      <button
                        onClick={() => onIssue(s.id)}
                        disabled={busy}
                        className="shrink-0 rounded-lg bg-stone-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
                      >
                        {t("📕 Issue")}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Book is not loanable (lost/withdrawn). */}
          {!loan && selected.status !== "active" && (
            <p className="mt-3 text-sm text-amber-700">{t("This book is marked {status}.", { status: selected.status })}</p>
          )}

          {results.length > 1 && (
            <button
              onClick={() => setSelected(null)}
              className="mt-4 text-xs text-stone-500 hover:underline"
            >
              {t("← Back to {count} matches", { count: results.length })}
            </button>
          )}
        </div>
      )}

      {searched && !busy && results.length === 0 && (
        <p className="mt-4 text-sm text-stone-500">{t("No book found for “{code}”.", { code })}</p>
      )}
    </div>
  );
}
