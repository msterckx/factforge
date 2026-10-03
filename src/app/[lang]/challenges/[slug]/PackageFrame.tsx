"use client";

import { useEffect, useRef, useState } from "react";

export default function PackageFrame({ src, title }: { src: string; title: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(600);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let ro: ResizeObserver | null = null;

    function measure() {
      try {
        const doc = iframe!.contentWindow?.document;
        if (!doc) return;
        const h = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight);
        if (h > 0) setHeight(h);
      } catch {
        /* cross-origin — keep last known height */
      }
    }

    function onLoad() {
      measure();
      try {
        const doc = iframe!.contentWindow?.document;
        if (doc?.documentElement) {
          ro = new ResizeObserver(() => measure());
          ro.observe(doc.documentElement);
        }
      } catch {
        /* ignore */
      }
    }

    iframe.addEventListener("load", onLoad);
    window.addEventListener("resize", measure);
    if (iframe.contentDocument?.readyState === "complete") onLoad();

    return () => {
      iframe.removeEventListener("load", onLoad);
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, []);

  return (
    <iframe
      ref={iframeRef}
      src={src}
      title={title}
      className="w-full border-0 rounded-xl block"
      style={{ height }}
    />
  );
}
