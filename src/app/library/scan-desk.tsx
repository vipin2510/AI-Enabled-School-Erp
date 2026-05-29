"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { issueBook, returnBook } from "./actions";

type Book = { code: string; title: string; author: string | null; category: string | null; status: string };
type Loan = {
  id: string;
  issued_at: string;
  due_date: string | null;
  students: { id: string; full_name: string; section: string | null; classes: { display_name: string } | null } | null;
};
type Lookup = { book: Book | null; loan: Loan | null };
type StudentHit = { id: string; full_name: string; admission_no: string | null; class: string; openLoans: number };

// html5-qrcode is loaded lazily so it never runs during SSR.
type Scanner = { start: (a: unknown, b: unknown, c: (t: string) => void, d: () => void) => Promise<void>; stop: () => Promise<void>; clear: () => void };

// Book IDs are numeric. The input rejects anything else so the operator can
// just enter a number and press Enter — no mode toggle needed; we infer
// issue-vs-return from the book's current loan state.
const stripNonDigits = (s: string) => s.replace(/\D+/g, "");

export default function ScanDesk() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [studentQuery, setStudentQuery] = useState("");
  const [students, setStudents] = useState<StudentHit[]>([]);

  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Scanner | null>(null);

  const codeInputRef = useRef<HTMLInputElement>(null);

  const doLookup = useCallback(async (raw: string) => {
    const c = stripNonDigits(raw);
    if (!c) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/library/lookup?code=${encodeURIComponent(c)}`);
      setLookup((await res.json()) as Lookup);
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
          const digits = stripNonDigits(decoded);
          setCode(digits);
          stopScan();
          doLookup(digits);
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
    setLookup(null);
    setStudents([]);
    setStudentQuery("");
    // Keep the desk ready for the next book without forcing another click.
    codeInputRef.current?.focus();
  };

  const onIssue = async (studentId: string) => {
    setBusy(true);
    const r = await issueBook(code, studentId);
    setBusy(false);
    if (r.error) setMsg({ kind: "err", text: r.error });
    else {
      setMsg({ kind: "ok", text: r.message ?? "Issued." });
      reset();
      router.refresh();
    }
  };

  const onReturn = async () => {
    setBusy(true);
    const r = await returnBook(code);
    setBusy(false);
    if (r.error) setMsg({ kind: "err", text: r.error });
    else {
      setMsg({ kind: "ok", text: r.message ?? "Collected." });
      reset();
      router.refresh();
    }
  };

  const book = lookup?.book;
  const loan = lookup?.loan;

  return (
    <div className="card p-5">
      <p className="mb-3 text-sm text-stone-500">
        Type or scan the book&rsquo;s number and press <kbd className="rounded border border-stone-300 bg-stone-50 px-1.5 py-0.5 font-mono text-xs">Enter</kbd>.
        We&rsquo;ll figure out if it needs to be issued or collected.
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
          inputMode="numeric"
          pattern="\d*"
          onChange={(e) => setCode(stripNonDigits(e.target.value))}
          placeholder="Book number"
          className="w-56 rounded-lg border border-stone-300 bg-white px-3 py-2 text-base font-mono tracking-wider outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
        />
        <button
          type="submit"
          disabled={busy || !code}
          className="rounded-lg bg-stone-900 px-5 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
        >
          {busy ? "Looking up…" : "Look up"}
        </button>
        {scanning ? (
          <button type="button" onClick={stopScan} className="rounded-lg border border-stone-200 px-4 py-2 text-sm">
            Stop camera
          </button>
        ) : (
          <button type="button" onClick={startScan} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            📷 Scan QR
          </button>
        )}
      </form>

      <div id="qr-reader" className={scanning ? "mt-4 max-w-sm overflow-hidden rounded-lg border border-stone-200" : "hidden"} />

      {msg && (
        <p className={"mt-3 text-sm " + (msg.kind === "ok" ? "text-green-700" : "text-red-600")}>{msg.text}</p>
      )}

      {/* result */}
      {book && (
        <div className="mt-4 rounded-lg border border-stone-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold text-stone-900">{book.title}</div>
              <div className="text-sm text-stone-500">
                <span className="font-mono">{book.code}</span>
                {book.author ? ` · ${book.author}` : ""}
              </div>
            </div>
            {loan ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Issued</span>
            ) : (
              <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">Available</span>
            )}
          </div>

          {/* Book is currently issued → only thing to do is collect it back. */}
          {loan && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-stone-600">
                Held by <strong>{loan.students?.full_name ?? "—"}</strong>
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
                ↩ Collect book
              </button>
            </div>
          )}

          {/* Book is on the shelf → ready to issue to a student. */}
          {!loan && (
            <div className="mt-4">
              <div className="mb-2 text-sm font-medium text-stone-700">Issue to student</div>
              <input
                value={studentQuery}
                onChange={(e) => searchStudents(e.target.value)}
                placeholder="Search student by name or admission no.…"
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
                        📕 Issue
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {code && lookup && !book && (
        <p className="mt-4 text-sm text-stone-500">No book found for &ldquo;{code}&rdquo;.</p>
      )}
    </div>
  );
}
