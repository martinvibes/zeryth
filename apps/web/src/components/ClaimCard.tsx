import { Mark } from "./Mark";
import { Qr } from "./Qr";

/**
 * A claim card: navy stock, a gold edge, the amount and a QR that opens the card's
 * link. The same face is printed on paper, shown on the claim page and fanned out on
 * the landing page.
 */
export function ClaimCard({
  amount,
  label,
  link,
  tilt = 0,
  className = "",
}: {
  amount: string;
  label: string;
  link?: string;
  tilt?: number;
  className?: string;
}) {
  return (
    <div className={`claim-card ${className}`} style={{ ["--tilt" as string]: `${tilt}deg` }}>
      <div className="claim-card-top">
        <Mark size={22} tone="frost" />
        <span className="claim-card-label">{label}</span>
      </div>
      <div className="claim-card-amount num">{amount}</div>
      <div className="claim-card-bottom">
        <span className="claim-card-hint">Scan to claim. Whoever holds this card holds the money.</span>
        {link ? <Qr value={link} size={84} label="Claim card QR code" /> : <span className="claim-card-qr-blank" />}
      </div>
      <span className="claim-card-sheen" aria-hidden="true" />
    </div>
  );
}
