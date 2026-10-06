"use client";

import { useState, useEffect } from "react";

// Shared hook for all logo cards.
// 1) Trims blank (transparent / white) margins baked into logo files so every
//    logo's visible content reaches the margin line.
// 2) Places the trimmed logo, centered and un-stretched, on a square (1:1) white canvas.
// Falls back to the original image if the browser blocks pixel access (CORS) or anything fails.
export function useTrimmedSrc(src) {
  const [out, setOut] = useState(src);

  useEffect(() => {
    setOut(src);
    if (!src) return;
    let cancelled = false;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const W = img.naturalWidth, H = img.naturalHeight;
        if (!W || !H) return;
        const s = Math.min(1, 300 / Math.max(W, H));
        const sw = Math.max(1, Math.round(W * s)), sh = Math.max(1, Math.round(H * s));
        const c1 = document.createElement("canvas");
        c1.width = sw; c1.height = sh;
        const x1 = c1.getContext("2d", { willReadFrequently: true });
        x1.drawImage(img, 0, 0, sw, sh);
        const d = x1.getImageData(0, 0, sw, sh).data;
        let minX = sw, minY = sh, maxX = -1, maxY = -1;
        for (let y = 0; y < sh; y++) {
          for (let x = 0; x < sw; x++) {
            const i = (y * sw + x) * 4;
            const blank = d[i + 3] < 20 || (d[i] > 242 && d[i + 1] > 242 && d[i + 2] > 242);
            if (!blank) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX < 0) return;
        const cx = Math.floor(minX / s), cy = Math.floor(minY / s);
        const cw = Math.min(W - cx, Math.ceil((maxX - minX + 1) / s));
        const ch = Math.min(H - cy, Math.ceil((maxY - minY + 1) / s));
        // Square white canvas (1:1); logo centered, never stretched.
        const side = Math.max(cw, ch);
        const k = Math.min(1, 480 / side);
        const c2 = document.createElement("canvas");
        c2.width = Math.max(1, Math.round(side * k));
        c2.height = c2.width;
        const ctx2 = c2.getContext("2d");
        ctx2.fillStyle = "#ffffff";
        ctx2.fillRect(0, 0, c2.width, c2.height);
        const dw = cw * k, dh = ch * k;
        ctx2.drawImage(img, cx, cy, cw, ch, (c2.width - dw) / 2, (c2.height - dh) / 2, dw, dh);
        const url = c2.toDataURL("image/png");
        if (!cancelled) setOut(url);
      } catch (e) { /* tainted canvas / CORS — keep original */ }
    };
    img.src = src;
    return () => { cancelled = true; };
  }, [src]);

  return out;
}