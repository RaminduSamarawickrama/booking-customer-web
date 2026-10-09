import { lazy, Suspense, useState, type FormEvent } from "react";
import { ApiError } from "@booking/shared/auth";
import { formatMoney, type Booking } from "@booking/shared/booking";
import { formatCardNumber, TEST_CARDS, type Payment } from "@booking/shared/payments";
import { paymentsApi } from "../api";

const StripePayment = lazy(() => import("./StripePayment"));

type Phase =
  | { name: "idle" }
  | { name: "starting" }
  | { name: "form"; payment: Payment }
  | { name: "confirming"; payment: Payment }
  | { name: "paid" };

function message(error: unknown): string {
  return error instanceof ApiError ? error.message : "Payment is unavailable right now. Try again in a moment.";
}

/**
 * Pay for a pending booking. The booking is confirmed by the server once the payment
 * succeeds; onPaid lets the page wait for that and refresh.
 */
export function PaymentPanel({ booking, token, onPaid }: { booking: Booking; token?: string; onPaid: () => void }) {
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [error, setError] = useState("");
  const total = formatMoney(booking.totalMinor, booking.currency);

  async function start() {
    setError("");
    setPhase({ name: "starting" });
    try {
      setPhase({ name: "form", payment: await paymentsApi.start(booking.reference, token) });
    } catch (e) {
      setError(message(e));
      setPhase({ name: "idle" });
    }
  }

  function paid() {
    setPhase({ name: "paid" });
    onPaid();
  }

  if (phase.name === "paid") {
    return <p className="notice good" role="status">Payment received. Confirming your booking…</p>;
  }

  if (phase.name === "idle" || phase.name === "starting") {
    return (
      <div className="pay">
        {error && <p className="notice bad" role="alert">{error}</p>}
        <button type="button" className="signal wide" disabled={phase.name === "starting"} onClick={() => void start()}>
          {phase.name === "starting" ? "Opening secure payment…" : `Pay ${total}`}
        </button>
      </div>
    );
  }

  const payment = phase.payment;
  if (payment.provider === "stripe" && payment.clientSecret && payment.publishableKey) {
    return (
      <Suspense fallback={<p className="muted">Loading secure payment…</p>}>
        <StripePayment clientSecret={payment.clientSecret} publishableKey={payment.publishableKey} total={total}
          onPaid={paid} />
      </Suspense>
    );
  }
  return (
    <MockCardForm
      payment={payment}
      total={total}
      busy={phase.name === "confirming"}
      error={error}
      onSubmit={async (card) => {
        setError("");
        setPhase({ name: "confirming", payment });
        try {
          const result = await paymentsApi.confirmMock(payment.paymentId, card);
          if (result.status === "SUCCEEDED") return paid();
          setError(result.failureMessage ?? "Your card was declined.");
          // A declined attempt is finished; the next try starts a fresh one.
          setPhase({ name: "form", payment: await paymentsApi.start(booking.reference, token) });
        } catch (e) {
          setError(message(e));
          setPhase({ name: "form", payment });
        }
      }}
    />
  );
}

function MockCardForm(props: {
  payment: Payment;
  total: string;
  busy: boolean;
  error: string;
  onSubmit: (cardNumber: string) => Promise<void>;
}) {
  const [card, setCard] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    void props.onSubmit(card);
  }

  return (
    <form className="pay mock-card" onSubmit={submit}>
      <p className="test-banner mono">TEST MODE · no real money moves</p>
      <label className="field">
        <span>Card number</span>
        <input inputMode="numeric" autoComplete="off" placeholder="4242 4242 4242 4242" value={card}
          onChange={(e) => setCard(formatCardNumber(e.target.value))} required />
      </label>
      <div className="card-row">
        <label className="field">
          <span>Expiry</span>
          <input inputMode="numeric" placeholder="MM / YY" autoComplete="off" value={expiry} maxLength={7}
            onChange={(e) => setExpiry(e.target.value.replace(/[^\d/ ]/g, ""))} required />
        </label>
        <label className="field">
          <span>CVC</span>
          <input inputMode="numeric" placeholder="123" autoComplete="off" value={cvc} maxLength={4}
            onChange={(e) => setCvc(e.target.value.replace(/\D/g, ""))} required />
        </label>
      </div>
      {props.error && <p className="notice bad" role="alert">{props.error}</p>}
      <button type="submit" className="signal wide" disabled={props.busy}>
        {props.busy ? "Processing…" : `Pay ${props.total}`}
      </button>
      <details className="test-cards">
        <summary>Test cards</summary>
        <ul>
          {TEST_CARDS.map((c) => (
            <li key={c.number}>
              <button type="button" className="link mono" onClick={() => setCard(c.number)}>{c.number}</button>
              <span className="muted"> {c.outcome}</span>
            </li>
          ))}
        </ul>
      </details>
    </form>
  );
}
