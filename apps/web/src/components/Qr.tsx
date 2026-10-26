import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** A QR drawn as crisp SVG, ink on white, with a quiet zone wallets can find. */
export function Qr({ value, size = 220, label }: { value: string; size?: number; label: string }) {
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let live = true;
    QRCode.toString(value, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#0f2340", light: "#ffffff" } })
      .then((s) => live && setSvg(s))
      .catch(() => live && setSvg(""));
    return () => {
      live = false;
    };
  }, [value]);

  return (
    <div
      className="qr"
      role="img"
      aria-label={label}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
