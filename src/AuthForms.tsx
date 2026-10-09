import { useState, type FormEvent } from "react";
import { ApiError } from "@booking/shared/auth";
import { auth } from "./api";
import { hasPendingQuote } from "./booking/draft";
import { go } from "./route";

type Errors = Record<string, string>;

function describe(error: unknown): { message: string; fields: Errors } {
  if (error instanceof ApiError) {
    const fields: Errors = Object.fromEntries(error.fieldErrors.map((f) => [f.field, f.message]));
    if (error.code === "password_too_short" || error.code === "password_too_common" || error.code === "password_too_long") {
      fields.password = error.message;
    }
    if (error.code === "email_taken") fields.email = error.message;
    const ref = error.requestId ? ` (ref ${error.requestId.slice(0, 8)})` : "";
    return { message: Object.keys(fields).length ? "" : error.message + ref, fields };
  }
  return { message: "Something went wrong. Try again.", fields: {} };
}

function Field(props: {
  name: string;
  label: string;
  type?: string;
  autoComplete: string;
  hint?: string;
  error?: string;
  required?: boolean;
}) {
  const id = `f-${props.name}`;
  return (
    <label className="field" htmlFor={id}>
      <span>{props.label}</span>
      <input
        id={id}
        name={props.name}
        type={props.type ?? "text"}
        autoComplete={props.autoComplete}
        required={props.required ?? true}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={props.error ? `${id}-error` : props.hint ? `${id}-hint` : undefined}
      />
      {props.error ? (
        <span className="error" id={`${id}-error`}>
          {props.error}
        </span>
      ) : props.hint ? (
        <small id={`${id}-hint`}>{props.hint}</small>
      ) : null}
    </label>
  );
}

function useSubmit(action: (form: FormData) => Promise<unknown>) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [fields, setFields] = useState<Errors>({});
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setFields({});
    try {
      await action(new FormData(event.currentTarget));
      go(hasPendingQuote() ? "book" : "account");
    } catch (error) {
      const described = describe(error);
      setMessage(described.message);
      setFields(described.fields);
    } finally {
      setBusy(false);
    }
  }
  return { busy, message, fields, onSubmit };
}

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export function SignInForm() {
  const { busy, message, fields, onSubmit } = useSubmit((form) =>
    auth.login(text(form, "email"), String(form.get("password") ?? "")),
  );
  return (
    <form className="auth-card panel rise" onSubmit={onSubmit} noValidate={false}>
      <p className="eyebrow">Welcome back</p>
      <h1 className="auth-title">Sign in</h1>
      <Field name="email" label="Email" type="email" autoComplete="email" error={fields.email} />
      <Field name="password" label="Password" type="password" autoComplete="current-password" error={fields.password} />
      {message && <p className="notice bad" role="alert">{message}</p>}
      <button className="signal" type="submit" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="auth-switch">
        New here?{" "}
        <a href="#/signup">Create an account</a>
      </p>
    </form>
  );
}

export function SignUpForm() {
  const { busy, message, fields, onSubmit } = useSubmit((form) =>
    auth.register({
      email: text(form, "email"),
      password: String(form.get("password") ?? ""),
      fullName: text(form, "fullName"),
      phone: text(form, "phone") || undefined,
    }),
  );
  return (
    <form className="auth-card panel rise" onSubmit={onSubmit}>
      <p className="eyebrow">Two minutes, then you're set</p>
      <h1 className="auth-title">Create your account</h1>
      <Field name="fullName" label="Full name" autoComplete="name" error={fields.fullName} />
      <Field name="email" label="Email" type="email" autoComplete="email" error={fields.email} />
      <Field
        name="phone"
        label="Mobile number"
        type="tel"
        autoComplete="tel"
        required={false}
        hint="Optional. Your driver uses it if they can't find you."
        error={fields.phone}
      />
      <Field
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        hint="At least 10 characters. A short sentence works well."
        error={fields.password}
      />
      {message && <p className="notice bad" role="alert">{message}</p>}
      <button className="signal" type="submit" disabled={busy}>
        {busy ? "Creating account…" : "Create account"}
      </button>
      <p className="auth-switch">
        Already have an account? <a href="#/signin">Sign in</a>
      </p>
    </form>
  );
}
