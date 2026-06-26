import { useEffect, useState } from "react";
import QR from "qrcode";

export function QRCode({
  data,
  size = 160,
  label,
  color = "#0a0a0a",
  background = "#ffffff",
}: {
  data: string;
  size?: number;
  label?: string;
  color?: string;
  background?: string;
}) {
  const [imageSrc, setImageSrc] = useState<string>("");
  const resolvedSize = Math.max(96, Math.min(160, size));

  useEffect(() => {
    let cancelled = false;
    QR.toDataURL(data || " ", {
      errorCorrectionLevel: "M",
      margin: 1,
      width: resolvedSize,
      color: { dark: color, light: background },
    })
      .then((out) => {
        if (!cancelled) setImageSrc(out);
      })
      .catch(() => {
        if (!cancelled) setImageSrc("");
      });
    return () => {
      cancelled = true;
    };
  }, [background, color, data, resolvedSize]);

  return (
    <div className="inline-flex max-w-full flex-col items-center gap-2">
      <div
        className="grid place-items-center overflow-hidden rounded-2xl bg-white p-3 shadow-pop ring-4 ring-action"
        style={{ width: resolvedSize + 24, height: resolvedSize + 24 }}
        aria-label={label ?? "QR Code"}
      >
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={label ?? "QR Code"}
            width={resolvedSize}
            height={resolvedSize}
            className="block h-full w-full object-contain"
          />
        ) : (
          <div style={{ width: resolvedSize, height: resolvedSize, background }} />
        )}
      </div>
      {label && (
        <span className="max-w-[180px] text-center text-[11px] font-bold uppercase tracking-widest text-background/80">
          {label}
        </span>
      )}
    </div>
  );
}
