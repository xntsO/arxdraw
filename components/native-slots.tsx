'use client';
import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

type Slots = {
  toolbar: Element | null;
  properties: Element | null;
  history: Element | null;
};
// Excalidraw 0.18 has no toolbar render prop. Keep its layout and attach the
// additional tool to the existing row, including after responsive remounts.
export function useNativeSlots(root: RefObject<HTMLDivElement | null>) {
  const [slots, setSlots] = useState<Slots>({
    toolbar: null,
    properties: null,
    history: null,
  });
  useEffect(() => {
    const host = root.current;
    if (!host) return;
    const locate = () => {
      const next = {
        toolbar: host.querySelector('.App-toolbar > .Stack_horizontal'),
        properties:
          host.querySelector('.App-menu_top__left') ||
          host.querySelector('.layer-ui__wrapper'),
        history: host.querySelector('.undo-redo-buttons'),
      };
      setSlots((previous) =>
        previous.toolbar === next.toolbar &&
        previous.properties === next.properties &&
        previous.history === next.history
          ? previous
          : next,
      );
    };
    const observer = new MutationObserver(locate);
    observer.observe(host, { childList: true, subtree: true });
    locate();
    return () => observer.disconnect();
  }, [root]);
  return slots;
}
