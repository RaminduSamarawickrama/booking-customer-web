import { useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { CheckoutElementsProvider, PaymentElement, useCheckoutElements } from "@stripe/react-stripe-js/checkout";

/**
 * Stripe's Payment Element for a Checkout Session (ui_mode: elements). Card details go
 * straight to Stripe; the booking is confirmed by Stripe's webhook to payment-service.
 * Loaded only when payments run in Stripe mode.
 */
export default function StripePayment(props: { clientSecret: string; publishableKey: string; total: string; onPaid: () => void }) {
  const stripe = useMemo(() => loadStripe(props.publishableKey), [props.publishableKey]);
  return (
    <CheckoutElementsProvider
      stripe={stripe}
      options={{
        clientSecret: props.clientSecret,
        elementsOptions: {
          appearance: {
            theme: "flat",
            variables: { colorPrimary: "#10241f", borderRadius: "6px", fontFamily: "Bricolage Grotesque, system-ui, sans-serif" },
          },
        },
      }}
    >
      <Form total={props.total} onPaid={props.onPaid} />
    </CheckoutElementsProvider>
  );
}

function Form({ total, onPaid }: { total: string; onPaid: () => void }) {
  const result = useCheckoutElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (result.type === "loading") return <p className="muted">Loading secure payment…</p>;
  if (result.type === "error") return <p className="notice bad">{result.error.message}</p>;
  const { checkout } = result;

  async function pay() {
    setBusy(true);
    setError("");
    const confirmed = await checkout.confirm({ redirect: "if_required" });
    setBusy(false);
    if (confirmed.type === "success") onPaid();
    else setError(confirmed.error.message);
  }

  return (
    <div className="pay">
      <PaymentElement options={{ layout: "accordion" }} />
      {error && <p className="notice bad" role="alert">{error}</p>}
      <button type="button" className="signal wide" disabled={busy} onClick={() => void pay()}>
        {busy ? "Processing…" : `Pay ${total}`}
      </button>
    </div>
  );
}
