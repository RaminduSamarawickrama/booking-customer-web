import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ApiError } from "@booking/shared/auth";
import { formatMoney, newIdempotencyKey, type Extra, type VehicleCategory } from "@booking/shared/booking";
import { bookingApi, useSession } from "../api";
import { go } from "../route";
import { clearDraft, useDraft, type Draft } from "./draft";
import { rememberBooking } from "./guestBookings";
import { formatDistance, formatDuration, formatWhen } from "./time";

type Step = "vehicle" | "extras" | "details" | "review";
const STEPS: { id: Step; label: string }[] = [
  { id: "vehicle", label: "Vehicle" },
  { id: "extras", label: "Extras" },
  { id: "details", label: "Your details" },
  { id: "review", label: "Review" },
];

function useCatalog() {
  const [categories, setCategories] = useState<VehicleCategory[] | null>(null);
  const [extras, setExtras] = useState<Extra[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([bookingApi.vehicleCategories(), bookingApi.extras()])
      .then(([c, e]) => {
        setCategories(c);
        setExtras(e);
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Couldn't load vehicles."));
  }, []);
  return { categories, extras, error };
}

function useCountdown(until: string | undefined) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  return until ? Math.max(0, Math.floor((Date.parse(until) - now) / 60_000)) : 0;
}

function extrasTotal(draft: Draft): number {
  return Object.entries(draft.extras).reduce((sum, [code, qty]) => {
    const price = draft.quote?.extras.find((e) => e.code === code)?.priceMinor ?? 0;
    return sum + price * qty;
  }, 0);
}

function Summary({ draft, categories, extras }: { draft: Draft; categories: VehicleCategory[]; extras: Extra[] }) {
  const quote = draft.quote!;
  const option = quote.options.find((o) => o.categoryCode === draft.categoryCode);
  const category = categories.find((c) => c.code === draft.categoryCode);
  const extraTotal = extrasTotal(draft);
  return (
    <aside className="summary panel" aria-label="Your journey">
      <h2>Your journey</h2>
      <ol className="route">
        <li>
          <span className="mono">{formatWhen(quote.pickupAt)}</span>
          <strong>{quote.pickup.name}</strong>
        </li>
        <li>
          <span className="mono">{formatDistance(quote.distanceMeters)} · {formatDuration(quote.durationSeconds)}</span>
          <strong>{quote.dropoff.name}</strong>
        </li>
      </ol>
      <p className="muted small">
        {quote.passengers} {quote.passengers === 1 ? "passenger" : "passengers"} · {quote.luggage}{" "}
        {quote.luggage === 1 ? "suitcase" : "suitcases"}
      </p>
      {option && category && (
        <dl className="lines">
          <dt>{category.name}</dt>
          <dd>{formatMoney(option.priceMinor, quote.currency)}</dd>
          {Object.entries(draft.extras)
            .filter(([, q]) => q > 0)
            .map(([code, qty]) => {
              const extra = extras.find((e) => e.code === code);
              const price = quote.extras.find((e) => e.code === code)?.priceMinor ?? 0;
              return (
                <FragmentLine key={code} label={`${extra?.name ?? code}${qty > 1 ? ` × ${qty}` : ""}`}
                  value={formatMoney(price * qty, quote.currency)} />
              );
            })}
          <dt className="total">Total</dt>
          <dd className="total">{formatMoney(option.priceMinor + extraTotal, quote.currency)}</dd>
        </dl>
      )}
      <p className="muted small">Fixed price including airport fees and waiting time for delayed flights.</p>
    </aside>
  );
}

function FragmentLine({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function Progress({ step, onPick }: { step: Step; onPick: (s: Step) => void }) {
  const index = STEPS.findIndex((s) => s.id === step);
  return (
    <ol className="progress" aria-label="Booking steps">
      {STEPS.map((s, i) => (
        <li key={s.id} className={i < index ? "done" : i === index ? "current" : ""} aria-current={i === index ? "step" : undefined}>
          {i < index ? (
            <button type="button" className="link" onClick={() => onPick(s.id)}>
              {s.label}
            </button>
          ) : (
            <span>{s.label}</span>
          )}
        </li>
      ))}
    </ol>
  );
}

export function BookFlow() {
  const [draft, update] = useDraft();
  const session = useSession();
  const { categories, extras, error } = useCatalog();
  const [step, setStep] = useState<Step>("vehicle");
  const minutesLeft = useCountdown(draft.quote?.expiresAt);
  const [requoting, setRequoting] = useState(false);

  useEffect(() => {
    if (session && !draft.customerEmail) {
      update({ customerName: session.user.fullName, customerEmail: session.user.email, customerPhone: session.user.phone ?? "" });
    }
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!draft.quote) {
    return (
      <section className="flow-empty">
        <h1 className="display small-display">Start with your journey</h1>
        <p className="lead">Tell us where and when, and we'll show a fixed price for every vehicle.</p>
        <a className="button signal-button" href="#/">Plan a journey</a>
      </section>
    );
  }
  if (error) return <p className="notice bad">{error}</p>;
  if (!categories || !extras) return <p className="muted">Loading vehicles…</p>;

  const quote = draft.quote;
  const expired = minutesLeft <= 0;

  async function requote() {
    if (!draft.pickup || !draft.dropoff) return go("home");
    setRequoting(true);
    try {
      const fresh = await bookingApi.quote({
        pickupPlaceId: quote.pickup.id,
        dropoffPlaceId: quote.dropoff.id,
        pickupAt: quote.pickupAt,
        passengers: quote.passengers,
        luggage: quote.luggage,
      });
      update({ quote: fresh, categoryCode: fresh.options.some((o) => o.categoryCode === draft.categoryCode) ? draft.categoryCode : null });
    } catch {
      go("home");
    } finally {
      setRequoting(false);
    }
  }

  let body: ReactNode;
  if (step === "vehicle") body = <VehicleStep categories={categories} onNext={() => setStep("extras")} />;
  else if (step === "extras") body = <ExtrasStep extras={extras} onNext={() => setStep("details")} />;
  else if (step === "details") body = <DetailsStep onNext={() => setStep("review")} />;
  else body = <ReviewStep categories={categories} extras={extras} expired={expired} />;

  return (
    <div className="flow">
      <div className="flow-head">
        <Progress step={step} onPick={setStep} />
        <p className={`hold mono ${expired ? "bad" : ""}`} role="status">
          {expired ? (
            <>
              Prices expired.{" "}
              <button type="button" className="link" onClick={() => void requote()} disabled={requoting}>
                {requoting ? "Refreshing…" : "Refresh prices"}
              </button>
            </>
          ) : (
            `Price held for ${minutesLeft} min`
          )}
        </p>
      </div>
      <div className="flow-grid">
        <div className="flow-main rise">{body}</div>
        <Summary draft={draft} categories={categories} extras={extras} />
      </div>
    </div>
  );
}

function VehicleStep({ categories, onNext }: { categories: VehicleCategory[]; onNext: () => void }) {
  const [draft, update] = useDraft();
  const quote = draft.quote!;
  const rows = categories.map((category) => ({ category, option: quote.options.find((o) => o.categoryCode === category.code) }));
  return (
    <section aria-labelledby="vehicle-title">
      <h1 id="vehicle-title" className="step-title">Choose your vehicle</h1>
      <div className="vehicles" role="radiogroup" aria-labelledby="vehicle-title">
        {rows.map(({ category, option }) => {
          const selected = draft.categoryCode === category.code;
          return (
            <button
              key={category.code}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={!option}
              className={`vehicle ${selected ? "selected" : ""}`}
              onClick={() => update({ categoryCode: category.code })}
            >
              <span className="vehicle-name">{category.name}</span>
              <span className="vehicle-price mono">{option ? formatMoney(option.priceMinor, quote.currency) : "—"}</span>
              <span className="vehicle-desc">{category.description}</span>
              <span className="vehicle-meta mono">
                {category.maxPassengers} seats · {category.maxLuggage} cases · {category.exampleModels}
              </span>
              {!option && <span className="vehicle-meta">Too small for your party</span>}
            </button>
          );
        })}
      </div>
      <div className="step-actions">
        <a className="button secondary" href="#/">Change journey</a>
        <button type="button" className="signal" disabled={!draft.categoryCode} onClick={onNext}>
          Continue
        </button>
      </div>
    </section>
  );
}

function ExtrasStep({ extras, onNext }: { extras: Extra[]; onNext: () => void }) {
  const [draft, update] = useDraft();
  const quote = draft.quote!;
  return (
    <section aria-labelledby="extras-title">
      <h1 id="extras-title" className="step-title">Anything else?</h1>
      <ul className="extras">
        {extras.map((extra) => {
          const qty = draft.extras[extra.code] ?? 0;
          const price = quote.extras.find((e) => e.code === extra.code)?.priceMinor;
          if (price === undefined) return null;
          const set = (n: number) => update({ extras: { ...draft.extras, [extra.code]: n } });
          return (
            <li key={extra.code} className="extra panel">
              <div>
                <strong>{extra.name}</strong>
                <p className="muted small">{extra.description}</p>
              </div>
              <span className="mono">{formatMoney(price, quote.currency)}</span>
              {extra.maxQuantity === 1 ? (
                <label className="toggle">
                  <input type="checkbox" checked={qty === 1} onChange={(e) => set(e.target.checked ? 1 : 0)} />
                  <span>Add</span>
                </label>
              ) : (
                <div className="stepper" role="group" aria-label={extra.name}>
                  <button type="button" className="secondary" aria-label={`Fewer ${extra.name}`} disabled={qty <= 0} onClick={() => set(qty - 1)}>−</button>
                  <output>{qty}</output>
                  <button type="button" className="secondary" aria-label={`More ${extra.name}`} disabled={qty >= extra.maxQuantity} onClick={() => set(qty + 1)}>+</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="step-actions">
        <span />
        <button type="button" className="signal" onClick={onNext}>
          Continue
        </button>
      </div>
    </section>
  );
}

function DetailsStep({ onNext }: { onNext: () => void }) {
  const [draft, update] = useDraft();
  const session = useSession();
  const fromAirport = !!draft.quote?.pickup.airportIata;
  const [errors, setErrors] = useState<Record<string, string>>({});

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!draft.customerName.trim()) next.customerName = "Enter the lead passenger's name.";
    if (!/^\S+@\S+\.\S+$/.test(draft.customerEmail.trim())) next.customerEmail = "Enter an email for your confirmation.";
    if (!/^\+?[0-9 ()-]{6,20}$/.test(draft.customerPhone.trim())) next.customerPhone = "Enter a mobile number, e.g. +44 7700 900123.";
    if (fromAirport && !draft.flightNumber.trim()) next.flightNumber = "Add your flight number so we can track it.";
    setErrors(next);
    if (!Object.keys(next).length) onNext();
  }

  const field = (key: keyof Draft, label: string, props: Record<string, string> = {}, hint?: string) => (
    <label className="field">
      <span>{label}</span>
      <input
        {...props}
        value={String(draft[key] ?? "")}
        aria-invalid={errors[key] ? true : undefined}
        onChange={(e) => update({ [key]: e.target.value } as Partial<Draft>)}
      />
      {errors[key] ? <span className="error">{errors[key]}</span> : hint ? <small>{hint}</small> : null}
    </label>
  );

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby="details-title">
      <h1 id="details-title" className="step-title">Who's travelling?</h1>
      {!session && (
        <p className="notice info">
          No account needed. <a href="#/signin">Sign in</a> to save this booking to your account.
        </p>
      )}
      <div className="details-grid">
        {field("customerName", "Lead passenger", { autoComplete: "name" })}
        {field("customerEmail", "Email", { type: "email", autoComplete: "email" }, "We send your confirmation here.")}
        {field("customerPhone", "Mobile", { type: "tel", autoComplete: "tel" }, "Your driver calls this number if needed.")}
        {fromAirport &&
          field("flightNumber", "Flight number", { autoCapitalize: "characters", placeholder: "e.g. BA117" },
            "We track it and adjust the pickup if you land early or late.")}
      </div>
      <label className="field">
        <span>Notes for the driver</span>
        <textarea rows={3} maxLength={500} value={draft.driverNotes} onChange={(e) => update({ driverNotes: e.target.value })}
          placeholder="Door code, large items, accessibility needs…" />
      </label>
      <div className="step-actions">
        <span />
        <button type="submit" className="signal">Review booking</button>
      </div>
    </form>
  );
}

function ReviewStep({ categories, extras, expired }: { categories: VehicleCategory[]; extras: Extra[]; expired: boolean }) {
  const [draft, update] = useDraft();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const category = useMemo(() => categories.find((c) => c.code === draft.categoryCode), [categories, draft.categoryCode]);

  async function confirm() {
    const key = draft.idempotencyKey ?? newIdempotencyKey();
    if (!draft.idempotencyKey) update({ idempotencyKey: key });
    setBusy(true);
    setError("");
    try {
      const created = await bookingApi.create(
        {
          quoteId: draft.quote!.id,
          categoryCode: draft.categoryCode!,
          extras: Object.entries(draft.extras).filter(([, q]) => q > 0).map(([code, quantity]) => ({ code, quantity })),
          customerName: draft.customerName.trim(),
          customerEmail: draft.customerEmail.trim(),
          customerPhone: draft.customerPhone.trim(),
          flightNumber: draft.flightNumber.trim() || undefined,
          driverNotes: draft.driverNotes.trim() || undefined,
        },
        key,
      );
      rememberBooking(created.booking.reference, created.manageToken);
      clearDraft();
      go({ name: "booking", reference: created.booking.reference, token: created.manageToken });
    } catch (e) {
      setError(e instanceof ApiError ? `${e.message}${e.requestId ? ` (ref ${e.requestId.slice(0, 8)})` : ""}` : "Couldn't place the booking. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="review-title">
      <h1 id="review-title" className="step-title">Check and book</h1>
      <dl className="review panel">
        <dt>Vehicle</dt>
        <dd>{category?.name}</dd>
        <dt>Lead passenger</dt>
        <dd>
          {draft.customerName}
          <br />
          <span className="muted">{draft.customerEmail} · {draft.customerPhone}</span>
        </dd>
        {draft.flightNumber && (
          <>
            <dt>Flight</dt>
            <dd className="mono">{draft.flightNumber.toUpperCase()}</dd>
          </>
        )}
        {draft.driverNotes && (
          <>
            <dt>Notes</dt>
            <dd>{draft.driverNotes}</dd>
          </>
        )}
        <dt>Extras</dt>
        <dd>
          {Object.entries(draft.extras).filter(([, q]) => q > 0).map(([code, q]) => `${extras.find((e) => e.code === code)?.name ?? code}${q > 1 ? ` × ${q}` : ""}`).join(", ") || "None"}
        </dd>
      </dl>
      <p className="muted small">
        Next you'll pay securely. We hold your booking for 30 minutes while you do.
      </p>
      {error && <p className="notice bad" role="alert">{error}</p>}
      <div className="step-actions">
        <span />
        <button type="button" className="signal" disabled={busy || expired} onClick={() => void confirm()}>
          {busy ? "Booking…" : expired ? "Refresh prices to book" : "Book and pay"}
        </button>
      </div>
    </section>
  );
}
