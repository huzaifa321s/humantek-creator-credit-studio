'use client';

import React, { useEffect } from 'react';
import { reportClientError } from '@/lib/client-error-reporter';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Studio global application error:', error);
    reportClientError({
      area: 'Global Root Layout Crash',
      severity: 'CRITICAL',
      error,
    });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, backgroundColor: '#09090b', color: '#fafafa', fontFamily: 'sans-serif' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <div style={{ maxWidth: '420px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>
              Something Went Wrong
            </h1>
            <p style={{ fontSize: '14px', color: '#a1a1aa', marginBottom: '24px', lineHeight: 1.6 }}>
              An unexpected error occurred while loading Humantek Creator Credit Studio. Our team has been notified.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                backgroundColor: '#f59e0b',
                color: '#09090b',
                fontWeight: 700,
                fontSize: '14px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
