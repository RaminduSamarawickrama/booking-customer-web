import { useEffect, useState } from "react";
import { ApiError } from "@booking/shared/auth";
import { formatMoney, type Booking, type Extra, type VehicleCategory } from "@booking/shared/booking";
import { bookingApi, useSession } from "../api";
import { href } from "../route";
import { tokenFor } from "./guestBookings";
import { formatDistance, formatDuration, formatWhen } from "./time";

const STATUS: Record<Booking["status"], { label: string; tone: string; help: string }> = {
  PENDING_PAYMENT: { label: "Pending payment", tone: "signal", help: "We're holding this booking for 30 minutes. Online payment is coming in the next release." },
  CONFIRMED: { label: "Confirmed", tone: "good", help: "You're booked. We'll send your driver's details before pickup." },
  CANCELLED: { label: "Cancelled", tone: "bad", help: "This booking was cancelled." },
  EXPIRED: { label: "Expired", tone: "bad", help: "This booking wasn't paid in time, so it was released." },
};

export function BookingPage({ reference, token: linkToken }: { reference: string; token?: string }) {
  const session = useSession();
  const token = linkToken ?? tokenFor(reference);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [names, setNames] = useState<{ categories: VehicleCategory[]; extras: Extra[] }>({ categories: [], extras: [] });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setError("");
    bookingApi.get(reference, token).then(setBooking).catch((e: unknown) =>
      setError(e instanceof ApiError ? e.message : "Couldn't load this booking."));
    Promise.all([bookingApi.vehicleCategories(), bookingApi.extras()])
      .then(([categories, extras]) => setNames({ categories, extras }))
      .catch(() => undefined);
  }, [reference, token, session?.user.id]);

  if (error) {
    return (
      <section className="booking-page">
        <h1 className="display small-display">Booking not found</h1>
        <p className="lead">{error}</p>
        <p className="muted">Open the link from your confirmation, or sign in if you booked with your account.</p>
      </section>
    );
  }
  if (!booking) return <p className="muted">Loading booking…</p>;

  const status = STATUS[booking.status];
  const category = names.categories.find((c) => c.code === booking.categoryCode)?.name ?? booking.categoryCode;
  const link = `${window.location.origin}${window.location.pathname}${href({ name: "booking", reference, token })}`;

  async function act(action: "cancel" | "claim") {
    setBusy(true);
    try {
      setBooking(action === "cancel" ? await bookingApi.cancel(reference, token) : await bookingApi.claim(reference, token!));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="booking-page rise">
      <p className="eyebrow">Booking reference</p>
      <h1 className="display reference mono-display">{booking.reference}</h1>
      <p className={`status-pill ${status.tone}`}>{status.label}</p>
      <p className="lead">{status.help}</p>

      <div className="booking-grid">
        <div className="panel">
          <h2>Journey</h2>
          <ol className="route">
            <li>
              <span className="mono">{formatWhen(booking.pickupAt)}</span>
              <strong>{booking.pickup.name}</strong>
              <small className="muted">{booking.pickup.address}</small>
            </li>
            <li>
              <span className="mono">{formatDistance(booking.distanceMeters)} · about {formatDuration(booking.durationSeconds)}</span>
              <strong>{booking.dropoff.name}</strong>
              <small className="muted">{booking.dropoff.address}</small>
            </li>
          </ol>
          <dl className="facts-list">
            <dt>Vehicle</dt>
            <dd>{category}</dd>
            <dt>Party</dt>
            <dd>{booking.passengers} passengers · {booking.luggage} suitcases</dd>
            {booking.flightNumber && (
              <>
                <dt>Flight</dt>
                <dd className="mono">{booking.flightNumber}</dd>
              </>
            )}
            <dt>Lead passenger</dt>
            <dd>{booking.customerName} · {booking.customerPhone}</dd>
            {booking.driverNotes && (
              <>
                <dt>Notes</dt>
                <dd>{booking.driverNotes}</dd>
              </>
            )}
          </dl>
        </div>
        <div className="panel">
          <h2>Price</h2>
          <dl className="lines">
            <dt>{category}</dt>
            <dd>{formatMoney(booking.vehiclePriceMinor, booking.currency)}</dd>
            {booking.extras.map((e) => (
              <Line key={e.code} label={`${names.extras.find((x) => x.code === e.code)?.name ?? e.code}${e.quantity > 1 ? ` × ${e.quantity}` : ""}`}
                value={formatMoney(e.totalMinor, booking.currency)} />
            ))}
            <dt className="total">Total</dt>
            <dd className="total">{formatMoney(booking.totalMinor, booking.currency)}</dd>
          </dl>
          <div className="booking-actions">
            {token && (
              <button type="button" className="secondary" onClick={() => void navigator.clipboard?.writeText(link).then(() => setCopied(true))}>
                {copied ? "Link copied" : "Copy booking link"}
              </button>
            )}
            {session && token && !booking.linkedToAccount && (
              <button type="button" className="secondary" disabled={busy} onClick={() => void act("claim")}>
                Save to my account
              </button>
            )}
            {booking.status === "PENDING_PAYMENT" && (
              <button type="button" className="danger" disabled={busy} onClick={() => void act("cancel")}>
                Cancel booking
              </button>
            )}
          </div>
          {token && !session && (
            <p className="muted small">Keep the booking link: it's how you open this booking without an account.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

/** "My bookings": from the account when signed in, plus ones made as a guest on this device. */
export function MyBookings() {
  const session = useSession();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  useEffect(() => {
    if (!session) return setBookings([]);
    bookingApi.mine().then(setBookings).catch(() => setBookings([]));
  }, [session?.user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="my-bookings">
      <h2 className="section-title">Your bookings</h2>
      {bookings === null ? (
        <p className="muted">Loading…</p>
      ) : bookings.length === 0 ? (
        <p className="muted">No bookings on your account yet. <a href="#/">Book a transfer</a>.</p>
      ) : (
        <ul className="booking-list">
          {bookings.map((b) => (
            <li key={b.reference}>
              <a className="panel booking-row" href={href({ name: "booking", reference: b.reference, token: tokenFor(b.reference) })}>
                <span className="mono">{b.reference}</span>
                <span>{b.pickup.name} → {b.dropoff.name}</span>
                <span className="mono muted">{formatWhen(b.pickupAt)}</span>
                <span className={`status-pill ${STATUS[b.status].tone}`}>{STATUS[b.status].label}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
