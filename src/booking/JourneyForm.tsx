import { useState, type FormEvent } from "react";
import { ApiError } from "@booking/shared/auth";
import { bookingApi } from "../api";
import { go } from "../route";
import { useDraft } from "./draft";
import { PlaceField } from "./PlaceField";
import { todayInZone, zonedToIso } from "./time";

function Stepper(props: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="field stepper-field">
      <span>{props.label}</span>
      <div className="stepper" role="group" aria-label={props.label}>
        <button type="button" className="secondary" aria-label={`Fewer ${props.label.toLowerCase()}`}
          disabled={props.value <= props.min} onClick={() => props.onChange(props.value - 1)}>−</button>
        <output aria-live="polite">{props.value}</output>
        <button type="button" className="secondary" aria-label={`More ${props.label.toLowerCase()}`}
          disabled={props.value >= props.max} onClick={() => props.onChange(props.value + 1)}>+</button>
      </div>
    </div>
  );
}

/** Step 1: where, when and how many. Prices every vehicle in one quote. */
export function JourneyForm({ compact = false }: { compact?: boolean }) {
  const [draft, update] = useDraft();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!draft.pickup) next.pickup = "Choose a pickup from the suggestions.";
    if (!draft.dropoff) next.dropoff = "Choose a destination from the suggestions.";
    if (!draft.date) next.date = "Pick a date.";
    setErrors(next);
    if (Object.keys(next).length || !draft.pickup || !draft.dropoff) return;
    setBusy(true);
    try {
      const quote = await bookingApi.quote({
        pickupPlaceId: draft.pickup.id,
        dropoffPlaceId: draft.dropoff.id,
        pickupAt: zonedToIso(draft.date, draft.time),
        passengers: draft.passengers,
        luggage: draft.luggage,
      });
      update({ quote, categoryCode: null });
      go("book");
    } catch (e) {
      setErrors({ form: e instanceof ApiError ? e.message : "Couldn't get prices. Try again." });
    } finally {
      setBusy(false);
    }
  }

  function swap() {
    update({ pickup: draft.dropoff, dropoff: draft.pickup });
  }

  return (
    <form className={`journey panel ${compact ? "compact" : ""}`} onSubmit={onSubmit} noValidate>
      <p className="eyebrow">Get a fixed price</p>
      <div className="journey-places">
        <PlaceField label="From" placeholder="Airport, station, hotel…" value={draft.pickup}
          onChange={(pickup) => update({ pickup })} error={errors.pickup} />
        <button type="button" className="swap secondary" onClick={swap} aria-label="Swap pickup and destination">⇅</button>
        <PlaceField label="To" placeholder="Where are you going?" value={draft.dropoff}
          onChange={(dropoff) => update({ dropoff })} error={errors.dropoff} />
      </div>
      <div className="journey-when">
        <label className="field">
          <span>Date</span>
          <input type="date" min={todayInZone()} value={draft.date} aria-invalid={errors.date ? true : undefined}
            onChange={(e) => update({ date: e.target.value })} />
          {errors.date && <span className="error">{errors.date}</span>}
        </label>
        <label className="field">
          <span>Pickup time</span>
          <input type="time" step={300} value={draft.time} onChange={(e) => update({ time: e.target.value })} />
        </label>
      </div>
      <div className="journey-party">
        <Stepper label="Passengers" value={draft.passengers} min={1} max={16} onChange={(passengers) => update({ passengers })} />
        <Stepper label="Suitcases" value={draft.luggage} min={0} max={16} onChange={(luggage) => update({ luggage })} />
      </div>
      <p className="hint small">UK time. For airport pickups, enter when your flight lands.</p>
      {errors.form && <p className="notice bad" role="alert">{errors.form}</p>}
      <button className="signal wide" type="submit" disabled={busy}>
        {busy ? "Finding prices…" : "See prices"}
      </button>
    </form>
  );
}
