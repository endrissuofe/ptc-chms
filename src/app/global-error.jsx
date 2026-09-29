'use client';

/**
 * Last-resort screen if the whole app fails to start (the normal error screens live inside each
 * section). It can't use the app's styles, so it is plain and self-contained.
 */
export default function GlobalError({ reset }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#faf7f2',
          color: '#1e1b3a',
          padding: 24,
        }}
      >
        <main style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontSize: 24 }}>Ptchapel didn’t load</h1>
          <p style={{ color: '#625e7d' }}>
            Something went wrong. Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              minHeight: 48,
              padding: '0 24px',
              borderRadius: 999,
              border: 0,
              background: '#4f46e5',
              color: '#fff',
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
