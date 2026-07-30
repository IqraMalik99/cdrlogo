"use client";

import { useEffect, useState } from "react";
import { GoogleTagManager } from "@next/third-parties/google";


export default function DeferredGTM({ gtmId }) {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (shouldLoad) return;

    const load = () => setShouldLoad(true);
    const events = ["scroll", "mousemove", "keydown", "touchstart"];

    events.forEach((e) =>
      window.addEventListener(e, load, { once: true, passive: true })
    );

    const timeout = setTimeout(load, 4000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, load));
      clearTimeout(timeout);
    };
  }, [shouldLoad]);

  if (!shouldLoad) return null;

  return <GoogleTagManager gtmId={gtmId} />;
}