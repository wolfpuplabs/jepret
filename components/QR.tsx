"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function useQrDataUrl(value: string, size = 720) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: "M", color: { dark: "#1e1a15", light: "#ffffff" } })
      .then(setUrl)
      .catch(() => setUrl(null));
  }, [value, size]);
  return url;
}

export function QRImage({ value, alt }: { value: string; alt: string }) {
  const url = useQrDataUrl(value);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} width={240} height={240} />
  ) : (
    <div style={{ width: 240, height: 240 }} />
  );
}
