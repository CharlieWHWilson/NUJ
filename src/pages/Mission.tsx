import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowRight, Coffee, Hand, Heart, UsersRound } from "lucide-react";
import { APP_STORE_URL } from "@/lib/mateInvite";
import "./Mission.css";

const Mission = () => {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "About NUJ";
    return () => { document.title = previousTitle; };
  }, []);

  return (
    <div className="mission-page">
      <a className="mission-skip" href="#mission-content">Skip to content</a>
      <header className="mission-header mission-container">
        <Link to="/" aria-label="NUJ home" className="text-3xl font-bold tracking-tight">NUJ</Link>
        <nav aria-label="Website navigation">
          <a href={APP_STORE_URL} className="mission-button mission-button-small">Get NUJ for iPhone <ArrowRight size={16} aria-hidden="true" /></a>
        </nav>
      </header>

      <main id="mission-content">
        <section className="mission-hero mission-container" aria-labelledby="mission-title">
          <div>
            <span className="mission-symbol bg-secondary" aria-hidden="true"><Hand /></span>
            <h1 id="mission-title">Stay connected</h1>
            <p className="mission-intro">NUJ lets you check in with mates without needing to think of something to say.</p>
            <p>It's a simple way to keep in touch, so catching up in person feels a little easier.</p>
            <p>There's no need to keep NUJ open or spend time browsing, it is designed to keep you connected between the times you can see each other in person.</p>
            <a className="mission-button" href={APP_STORE_URL}>Download on the App Store <ArrowRight size={18} aria-hidden="true" /></a>
            <p className="mt-3 text-xs text-muted-foreground">Available for iPhone. You can also <Link to="/auth?mode=register" className="underline underline-offset-4">create an account online</Link>, then sign in to the app with the same account.</p>
          </div>
          <div id="how" className="mission-rhythm" aria-labelledby="how-title">
            <h2 id="how-title">How NUJ works</h2>
            <div className="mission-rhythm-row"><span><Hand aria-hidden="true" /></span><div><strong>Check in.</strong><p>Tap once to show your mates you're around.</p></div></div>
            <div className="mission-rhythm-row"><span><UsersRound aria-hidden="true" /></span><div><strong>See your mates' check-ins.</strong><p>Connect individually or in a shared group.</p></div></div>
            <div className="mission-rhythm-row"><span><Heart aria-hidden="true" /></span><div><strong>Send a NUJ.</strong><p>Let someone know you're thinking of them. No message needed.</p></div></div>
          </div>
        </section>

        <nav className="mission-audience-nav mission-container" aria-label="Find what NUJ offers you">
          <a href="#mates">For groups of mates <ArrowDown size={16} aria-hidden="true" /></a>
          <a href="#community-groups">For community and support groups <ArrowDown size={16} aria-hidden="true" /></a>
          <a href="#businesses">For businesses and venues <ArrowDown size={16} aria-hidden="true" /></a>
        </nav>

        <section id="why" className="mission-why" aria-labelledby="why-title">
          <div className="mission-container">
            <h2 id="why-title">What NUJ is for</h2>
            <p className="mission-section-intro">Life gets busy, and it's easy to lose touch with people you care about. You might meet through a group or activity, then not hear from each other until the next meet-up. NUJ gives you a simple way to stay in touch in between.</p>
            <p className="mission-section-intro mt-4">NUJ makes it easier to let a mate know you're there, without the pressure of a conversation.</p>
          </div>
        </section>

        <section className="mission-community mission-container" aria-labelledby="community-title">
          <h2 id="community-title">Who NUJ is for</h2>

          <section id="mates" className="mission-audience" aria-labelledby="mates-title">
            <div>
              <span className="mission-symbol bg-secondary" aria-hidden="true"><UsersRound /></span>
              <p className="mission-eyebrow">Groups of mates</p>
              <h3 id="mates-title">Stay connected without messaging</h3>
              <p>Team mates, school mates, holiday mates etc.</p>
            </div>
            <div>
              <p>Create a group, check in with one tap and see when your mates last checked in. Send a NUJ to let someone know you're thinking of them. No group-chat conversation to keep up with.</p>
              <p className="mission-audience-value">Stay aware of each other’s presence between real life meet-ups, so it's easier to spend time together in person.</p>
              <a href={APP_STORE_URL} className="mission-text-link">Get NUJ for iPhone <ArrowRight size={18} aria-hidden="true" /></a>
            </div>
          </section>

          <section id="community-groups" className="mission-audience" aria-labelledby="community-groups-title">
            <div>
              <span className="mission-symbol bg-emerald-50" aria-hidden="true"><Heart /></span>
              <p className="mission-eyebrow">Community and support groups</p>
              <h3 id="community-groups-title">Keep your group connected between meetings.</h3>
              <p>Organised meet-up groups with a leader, host or organiser.</p>
            </div>
            <div>
              <p>If you run or host a group, invite members to a shared NUJ group. They can check in with each other and keep in touch between the meet-ups you organise, without needing to start a conversation.</p>
              <p className="mission-audience-value">A way for the people you bring together to stay connected beyond the meet-up. Joining NUJ is optional for members.</p>
              <a href={APP_STORE_URL} className="mission-text-link">Get NUJ for iPhone <ArrowRight size={18} aria-hidden="true" /></a>
            </div>
          </section>

          <section id="businesses" className="mission-audience" aria-labelledby="businesses-title">
            <div>
              <span className="mission-symbol bg-amber-50" aria-hidden="true"><Coffee /></span>
              <p className="mission-eyebrow">Businesses and venues</p>
              <h3 id="businesses-title">Give people a reason to meet at your venue.</h3>
              <p>Cafés, pubs and other places to get together.</p>
            </div>
            <div>
              <p>Join NUJ as a venue partner to help people meet at your venue. Offer an incentive, such as discounted coffee for a group, to make choosing your venue easier.</p>
              <p className="mission-audience-value">Give mates a reason to meet. Bring more people through your door.</p>
              <p>Venues can take part in a trial. Venue offers are not live yet.</p>
              <a href="mailto:charlie@nuj.social" className="mission-text-link">Email - charlie@nuj.social</a>
            </div>
          </section>

        </section>

        <section className="mission-belief" aria-labelledby="belief-title">
          <div className="mission-container">
            <h2 id="belief-title">Get started with NUJ</h2>
            <p>Create an account online or get started in the iPhone app. Use the same account in both.</p>
            <a href={APP_STORE_URL} className="mission-button">Download on the App Store <ArrowRight size={18} aria-hidden="true" /></a>
            <p className="mt-4"><Link to="/auth?mode=register" className="mission-text-link">Create an account online <ArrowRight size={18} aria-hidden="true" /></Link></p>
          </div>
        </section>

        <aside className="mission-sources mission-container" aria-label="Disclaimer">
          <p>NUJ is not a mental health service or a treatment for loneliness. If loneliness is affecting your wellbeing, consider talking to someone you trust or a health professional.</p>
        </aside>
      </main>

      <footer className="mission-footer mission-container">
        <p>NUJ</p>
        <nav aria-label="Footer navigation">
          <Link to="/support">Support</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
        </nav>
      </footer>
    </div>
  );
};

export default Mission;
