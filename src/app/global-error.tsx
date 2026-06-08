"use client";

// Global error boundary — catches exceptions thrown by the root layout itself
// (auth/session bootstrap, sidebar render). It replaces the whole document, so
// it must render its own <html>/<body>.
//
// Anything thrown inside a route is caught by ./error.tsx first; we only get
// here when the shell is the thing that failed.

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[global-error]", error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#fafaf9",
          color: "#1c1917",
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: "100%",
            background: "#fff",
            border: "1px solid #e7e5e4",
            borderRadius: 12,
            padding: 32,
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ fontSize: 12, color: "#78716c", textTransform: "uppercase", letterSpacing: 1 }}>
            Pathshala ERP
          </div>
          <h1 style={{ margin: "8px 0 12px", fontSize: 20, fontWeight: 600 }}>
            The app failed to start
          </h1>
          <p style={{ fontSize: 14, color: "#57534e", margin: "0 0 16px" }}>
            Reload the page. If the problem keeps happening, share the
            reference below with the admin.
          </p>
          {error.digest && (
            <p style={{ fontSize: 12, fontFamily: "ui-monospace, monospace", color: "#a8a29e" }}>
              Ref: {error.digest}
            </p>
          )}
          <button
            onClick={() => reset()}
            style={{
              marginTop: 8,
              background: "#1c1917",
              color: "#fafaf9",
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
