'use client';
import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string;
  }
}
export default function Home() {
  const [Editor, setEditor] = useState<ComponentType | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    window.EXCALIDRAW_ASSET_PATH = '/excalidraw/';
    import('@/components/arxdraw')
      .then((m) => setEditor(() => m.default))
      .catch(() => setError(true));
  }, []);
  return Editor ? (
    <Editor />
  ) : (
    <main className="boot">
      <strong>
        arxdraw<span>✳</span>
      </strong>
      <p>
        {error
          ? 'The editor could not load. Please refresh to try again.'
          : 'Opening your workspace…'}
      </p>
    </main>
  );
}
