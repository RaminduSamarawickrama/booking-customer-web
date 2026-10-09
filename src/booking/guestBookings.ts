/**
 * Bookings made on this device without an account: reference + manage token, so the
 * customer can find them again from "My bookings" even without the confirmation link.
 */
export interface SavedBooking {
  reference: string;
  token: string;
  savedAt: string;
}

const KEY = "booking.guestBookings";

export function savedBookings(): SavedBooking[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as SavedBooking[];
  } catch {
    return [];
  }
}

export function rememberBooking(reference: string, token: string) {
  const others = savedBookings().filter((b) => b.reference !== reference);
  try {
    localStorage.setItem(KEY, JSON.stringify([{ reference, token, savedAt: new Date().toISOString() }, ...others].slice(0, 20)));
  } catch {
    // storage unavailable: the confirmation link still works
  }
}

export function tokenFor(reference: string): string | undefined {
  return savedBookings().find((b) => b.reference === reference)?.token;
}
