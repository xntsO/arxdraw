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
    let cancelled = false;
    window.EXCALIDRAW_ASSET_PATH = '/excalidraw/';
    // UML skeleton conversion measures text immediately. Load its font before
    // mounting the editor so fallback-font widths cannot clip the first scene.
    const font = new FontFace(
      'Cascadia',
      'url(/excalidraw/fonts/Cascadia/CascadiaCode-Regular.woff2)',
    );
    Promise.all([import('@/components/arxdraw'), font.load()])
      .then(([module, loadedFont]) => {
        if (cancelled) return;
        document.fonts.add(loadedFont);
        setEditor(() => module.default);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return Editor ? (
    <Editor />
  ) : (
    <main className="boot">
      <strong>
        ArxDraw<span>✳</span>
      </strong>
      <p>
        {error
          ? 'The editor could not load. Please refresh to try again.'
          : 'Opening your workspace…'}
      </p>
    </main>
  );
}
