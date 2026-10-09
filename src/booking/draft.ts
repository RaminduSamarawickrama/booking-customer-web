import { useCallback, useEffect, useState } from "react";
import type { Place, Quote } from "@booking/shared/booking";

/** Everything the customer has chosen so far. Kept in sessionStorage so a refresh keeps it. */
export interface Draft {
  pickup: Place | null;
  dropoff: Place | null;
  date: string;
  time: string;
  passengers: number;
  luggage: number;
  quote: Quote | null;
  categoryCode: string | null;
  extras: Record<string, number>;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  flightNumber: string;
  driverNotes: string;
  /** One key per attempt: a retry after a lost response returns the same booking. */
  idempotencyKey: string | null;
}

const KEY = "booking.draft";

export const emptyDraft: Draft = {
  pickup: null,
  dropoff: null,
  date: "",
  time: "09:00",
  passengers: 1,
  luggage: 1,
  quote: null,
  categoryCode: null,
  extras: {},
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  flightNumber: "",
  driverNotes: "",
  idempotencyKey: null,
};

function load(): Draft {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? { ...emptyDraft, ...(JSON.parse(raw) as Partial<Draft>) } : emptyDraft;
  } catch {
    return emptyDraft;
  }
}

let current = load();
const listeners = new Set<(d: Draft) => void>();

export function updateDraft(change: Partial<Draft>) {
  // Any change to what is being booked starts a new attempt.
  const resetsAttempt = Object.keys(change).some((k) => k !== "idempotencyKey");
  current = { ...current, ...change, ...(resetsAttempt && !("idempotencyKey" in change) ? { idempotencyKey: null } : {}) };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // private mode: the draft lives in memory only
  }
  listeners.forEach((l) => l(current));
}

export function clearDraft(keepJourney = false) {
  updateDraft(
    keepJourney
      ? { ...emptyDraft, pickup: current.pickup, dropoff: current.dropoff, passengers: current.passengers, luggage: current.luggage }
      : emptyDraft,
  );
}

export function useDraft(): [Draft, (change: Partial<Draft>) => void] {
  const [draft, setDraft] = useState(current);
  useEffect(() => {
    listeners.add(setDraft);
    return () => {
      listeners.delete(setDraft);
    };
  }, []);
  return [draft, useCallback(updateDraft, [])];
}

/** True while a priced journey is waiting to be booked (used to return there after sign-in). */
export function hasPendingQuote(): boolean {
  return current.quote !== null;
}
