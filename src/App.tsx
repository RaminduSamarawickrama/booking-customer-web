import { ConnectionPanel } from "@booking/shared/ui/ConnectionPanel";
import { auth, useSession } from "./api";
import { SignInForm, SignUpForm } from "./AuthForms";
import { env } from "./env";
import { BookFlow } from "./booking/BookFlow";
import { BookingPage, MyBookings } from "./booking/BookingPage";
import { savedBookings } from "./booking/guestBookings";
import { JourneyForm } from "./booking/JourneyForm";
import { go, href, useRoute } from "./route";

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
  const recent = savedBookings().slice(0, 3);
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow rise">Airport transfers · fixed prices · flight tracked</p>
          <h1 className="display rise rise-1">
            Land. Walk out.
            <br />
            <em>Your driver is there.</em>
          </h1>
          <p className="lead rise rise-2">
            Book a private car to or from the airport at a price you see up front. No account needed. We watch your
            flight, so an early landing or a delay never leaves you waiting.
          </p>
          <ul className="promises rise rise-3">
            <li><span className="mono">01</span> Price fixed when you book</li>
            <li><span className="mono">02</span> Free waiting for delayed flights</li>
            <li><span className="mono">03</span> Cancel online any time before payment</li>
          </ul>
        </div>
        <div className="rise rise-2">
          <JourneyForm />
        </div>
      </section>
      {recent.length > 0 && (
        <section className="recent">
          <h2 className="section-title">Booked on this device</h2>
          <ul className="booking-list">
            {recent.map((b) => (
              <li key={b.reference}>
                <a className="panel booking-row" href={href({ name: "booking", reference: b.reference, token: b.token })}>
                  <span className="mono">{b.reference}</span>
                  <span className="muted">Open booking</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
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
      <MyBookings />
    </section>
  );
}

export function App() {
  const route = useRoute();
  return (
    <div className="shell">
      <Header />
      <main id="main">
        {route.name === "home" && <Home />}
        {route.name === "signin" && <SignInForm />}
        {route.name === "signup" && <SignUpForm />}
        {route.name === "account" && <Account />}
        {route.name === "book" && <BookFlow />}
        {route.name === "booking" && <BookingPage key={route.reference} reference={route.reference} token={route.token} />}
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
