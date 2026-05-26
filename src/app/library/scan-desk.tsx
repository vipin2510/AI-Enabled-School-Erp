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

export default function ScanDesk() {
  const router = useRouter();
  const [mode, setMode] = useState<"issue" | "return">("issue");
  const [code, setCode] = useState("");
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [studentQuery, setStudentQuery] = useState("");
  const [students, setStudents] = useState<StudentHit[]>([]);

  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Scanner | null>(null);

  const doLookup = useCallback(async (value: string) => {
    const c = value.trim();
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
          setCode(decoded);
          stopScan();
          doLookup(decoded);
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
      setMsg({ kind: "ok", text: r.message ?? "Returned." });
      reset();
      router.refresh();
    }
  };

  const book = lookup?.book;
  const loan = lookup?.loan;

  return (
    <div className="card p-5">
      {/* mode toggle */}
      <div className="mb-4 inline-flex rounded-lg border border-stone-200 p-0.5">
        {(["issue", "return"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              reset();
              setMsg(null);
            }}
            className={
              "rounded-md px-4 py-1.5 text-sm font-medium capitalize transition " +
              (mode === m ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100")
            }
          >
            {m}
          </button>
        ))}
      </div>

      {/* code entry + scan */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          doLookup(code);
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <input
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Scan or type book code, then Enter"
          className="w-72 rounded-lg border border-stone-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
        />
        <button type="submit" disabled={busy} className="rounded-lg border border-stone-200 bg-stone-100 px-4 py-2 text-sm font-medium text-stone-900 hover:bg-stone-200">
          Look up
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
          <div className="flex items-start justify-between">
            <div>
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

          {/* RETURN mode */}
          {mode === "return" &&
            (loan ? (
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-sm text-stone-600">
                  Held by <strong>{loan.students?.full_name ?? "—"}</strong>
                  {loan.students?.classes?.display_name ? ` (${loan.students.classes.display_name}${loan.students.section ? ` · ${loan.students.section}` : ""})` : ""}
                  {loan.due_date ? ` · due ${loan.due_date}` : ""}
                </div>
                <button onClick={onReturn} disabled={busy} className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50">
                  Mark returned
                </button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-stone-500">This book isn’t currently issued.</p>
            ))}

          {/* ISSUE mode */}
          {mode === "issue" &&
            (loan ? (
              <p className="mt-3 text-sm text-amber-700">
                Already issued to {loan.students?.full_name ?? "a student"}. Return it before re-issuing.
              </p>
            ) : (
              <div className="mt-3">
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
                          className="shrink-0 rounded-lg bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
                        >
                          Issue
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
        </div>
      )}

      {code && lookup && !book && (
        <p className="mt-4 text-sm text-stone-500">No book found for “{code}”.</p>
      )}
    </div>
  );
}
