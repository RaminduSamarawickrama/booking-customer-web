import { ConnectionPanel } from "@booking/shared/ui/ConnectionPanel";
import { auth, useSession } from "./api";
import { SignInForm, SignUpForm } from "./AuthForms";
import { env } from "./env";
import { go, useRoute } from "./route";

const BOARD = [
  { time: "06:40", place: "Heathrow T5", code: "BA 117", status: "Driver waiting" },
  { time: "07:15", place: "Gatwick South", code: "EZY 8921", status: "On time" },
  { time: "08:05", place: "Stansted", code: "FR 2214", status: "Landed" },
];

function Header() {
  const session = useSession();
  return (
    <header className="site-header">
      <a className="wordmark" href="#/">
        Transfers<span aria-hidden="true">.</span>
      </a>
      <nav aria-label="Account">
        {session ? (
          <>
            <a className="nav-link" href="#/account">
              {session.user.fullName.split(" ")[0]}
            </a>
            <button className="secondary" type="button" onClick={() => void auth.logout().then(() => go("home"))}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <a className="nav-link" href="#/signin">
              Sign in
            </a>
            <a className="button" href="#/signup">
              Create account
            </a>
          </>
        )}
      </nav>
    </header>
  );
}

function Home() {
  return (
    <section className="hero">
      <div>
        <p className="eyebrow rise">Airport transfers · fixed prices · flight tracked</p>
        <h1 className="display rise rise-1">
          Land. Walk out.
          <br />
          <em>Your driver is there.</em>
        </h1>
        <p className="lead rise rise-2">
          Book a private car to or from the airport at a price you see up front. We watch your flight, so an early
          landing or a delay never leaves you waiting.
        </p>
        <div className="hero-actions rise rise-3">
          <a className="button signal-button" href="#/signup">
            Create an account
          </a>
          <span className="hint">Booking opens in the next release.</span>
        </div>
      </div>
      <aside className="board rise rise-2" aria-label="Example arrivals">
        <p className="board-title mono">ARRIVALS · TODAY</p>
        <ul>
          {BOARD.map((row) => (
            <li key={row.code}>
              <span className="mono board-time">{row.time}</span>
              <span className="board-place">{row.place}</span>
              <span className="mono board-code">{row.code}</span>
              <span className="board-status">{row.status}</span>
            </li>
          ))}
        </ul>
      </aside>
    </section>
  );
}

function Account() {
  const session = useSession();
  if (!session) {
    return <SignInForm />;
  }
  const { user } = session;
  return (
    <section className="account rise">
      <p className="eyebrow">Your account</p>
      <h1 className="display account-name">{user.fullName}</h1>
      <dl className="account-facts panel">
        <dt>Email</dt>
        <dd>{user.email}</dd>
        <dt>Mobile</dt>
        <dd>{user.phone ?? "Not added"}</dd>
        <dt>Account type</dt>
        <dd>
          {user.roles.map((role) => (
            <span key={role} className="tag">
              {role.toLowerCase()}
            </span>
          ))}
        </dd>
      </dl>
      <p className="lead">Your bookings will appear here once booking opens.</p>
    </section>
  );
}

export function App() {
  const route = useRoute();
  return (
    <div className="shell">
      <Header />
      <main id="main">
        {route === "home" && <Home />}
        {route === "signin" && <SignInForm />}
        {route === "signup" && <SignUpForm />}
        {route === "account" && <Account />}
      </main>
      <footer className="site-footer">
        <details>
          <summary className="mono">Developer · backend connection</summary>
          <ConnectionPanel
            buildApiBaseUrl={env.apiBaseUrl}
            buildWebsocketUrl={env.websocketUrl}
            allowOverride={env.allowOverride}
          />
        </details>
      </footer>
    </div>
  );
}
