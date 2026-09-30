"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "Segoe UI, Arial, sans-serif", background: "#F4F8FC", color: "#0B1B33" }}>
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <div style={{ maxWidth: 480, textAlign: "center", background: "#fff", borderRadius: 24, padding: 32, boxShadow: "0 24px 60px rgba(6,43,91,0.18)" }}>
            <div style={{ width: 56, height: 56, margin: "0 auto", borderRadius: 16, background: "#FFF4E5", display: "grid", placeItems: "center", fontSize: 26 }}>!</div>
            <h1 style={{ fontSize: 22, marginTop: 16 }}>ATOMA could not load this page</h1>
            <p style={{ color: "#5B6B82", fontSize: 14, lineHeight: 1.6 }}>
              Your workforce file remains stored in this browser. Reload to try again.
            </p>
            {error?.message && <p style={{ color: "#8A9AB0", fontSize: 11, marginTop: 12, wordBreak: "break-word" }}>{error.message}</p>}
            <button
              type="button"
              onClick={reset}
              style={{ marginTop: 20, height: 42, padding: "0 22px", borderRadius: 12, border: 0, background: "#0D47A1", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
