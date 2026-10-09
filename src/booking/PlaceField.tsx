import { useEffect, useId, useRef, useState } from "react";
import type { Place } from "@booking/shared/booking";
import { bookingApi } from "../api";

/** Address search as you type: an accessible combobox (arrow keys, Enter, Escape). */
export function PlaceField(props: {
  label: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
  placeholder: string;
  error?: string;
}) {
  const id = useId();
  const [text, setText] = useState(props.value?.name ?? "");
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "empty" | "error">("idle");
  const lastPicked = useRef(props.value?.name ?? "");

  useEffect(() => {
    setText(props.value?.name ?? "");
    lastPicked.current = props.value?.name ?? "";
  }, [props.value?.id, props.value?.name]);

  useEffect(() => {
    const query = text.trim();
    if (query.length < 2 || query === lastPicked.current) {
      setResults([]);
      setStatus("idle");
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setStatus("loading");
      bookingApi
        .searchPlaces(query, controller.signal)
        .then((places) => {
          setResults(places);
          setActive(0);
          setStatus(places.length ? "idle" : "empty");
          setOpen(true);
        })
        .catch(() => {
          if (!controller.signal.aborted) setStatus("error");
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text]);

  function pick(place: Place) {
    lastPicked.current = place.name;
    setText(place.name);
    setOpen(false);
    setResults([]);
    props.onChange(place);
  }

  const listId = `${id}-list`;
  const showList = open && (results.length > 0 || status === "empty");
  return (
    <div className="field place-field">
      <label className="field-label" htmlFor={id}>
        {props.label}
      </label>
      <input
        id={id}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
        aria-invalid={props.error ? true : undefined}
        autoComplete="off"
        placeholder={props.placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (props.value) props.onChange(null);
        }}
        onFocus={() => results.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && results[active]) {
            e.preventDefault();
            pick(results[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {showList && (
        <ul className="place-list" role="listbox" id={listId}>
          {results.map((place, i) => (
            <li
              key={place.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(place);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className={`place-icon ${place.airportIata ? "air" : ""}`} aria-hidden="true">
                {place.airportIata ? "✈" : "●"}
              </span>
              <span>
                <strong>{place.name}</strong>
                <small>{place.address}</small>
              </span>
            </li>
          ))}
          {status === "empty" && <li className="place-empty">No matches. Try a station, airport or landmark.</li>}
        </ul>
      )}
      {status === "error" && <span className="error">Search is unavailable. Check the backend connection.</span>}
      {props.error && <span className="error">{props.error}</span>}
    </div>
  );
}
