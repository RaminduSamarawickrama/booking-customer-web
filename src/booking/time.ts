/** Rides happen in the operating area's local time, whatever the visitor's own time zone. */
export const SERVICE_ZONE = "Europe/London";

function offsetMs(at: Date, zone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - at.getTime();
}

/** "2026-10-12" + "09:30" in Europe/London -> the instant, as ISO 8601 UTC. */
export function zonedToIso(date: string, time: string, zone = SERVICE_ZONE): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let guess = wall;
  for (let i = 0; i < 3; i++) guess = wall - offsetMs(new Date(guess), zone);
  return new Date(guess).toISOString();
}

/** Today's date in the service zone, for the date picker's minimum. */
export function todayInZone(zone = SERVICE_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(new Date());
}

export function formatWhen(iso: string, zone = SERVICE_ZONE): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

export function formatDistance(meters: number): string {
  return `${(meters / 1609.344).toFixed(meters < 16_000 ? 1 : 0)} mi`;
}
