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
          <a href="#why">Why connection matters</a>
          <a href={APP_STORE_URL} className="mission-button mission-button-small">Get NUJ for iPhone <ArrowRight size={16} aria-hidden="true" /></a>
        </nav>
      </header>

      <main id="mission-content">
        <section className="mission-hero mission-container" aria-labelledby="mission-title">
          <div>
            <span className="mission-symbol bg-secondary" aria-hidden="true"><Hand /></span>
            <h1 id="mission-title">Stay connected between meet-ups.</h1>
            <p className="mission-intro">NUJ lets you check in with mates without starting a messaging conversation.</p>
            <p>NUJ supports small, regular contact to help maintain relationships and make meeting again in person easier.</p>
            <a className="mission-button" href={APP_STORE_URL}>Download on the App Store <ArrowRight size={18} aria-hidden="true" /></a>
            <p className="mt-3 text-xs text-muted-foreground">Available for iPhone.</p>
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
            <p className="mission-section-intro">Friendships can drift when routines change. Groups and activities help people meet, but maintaining contact between meet-ups can be harder. NUJ is designed to support that contact, not replace meeting in person.</p>
            <p className="mission-section-intro mt-4">Loneliness can affect anyone when their social needs aren't met. It isn't the same as being alone, and everyone's needs are different. NUJ addresses one part of this: making regular contact easier.</p>
          </div>
        </section>

        <section className="mission-community mission-container" aria-labelledby="community-title">
          <h2 id="community-title">Who NUJ is for</h2>

          <section id="mates" className="mission-audience" aria-labelledby="mates-title">
            <div>
              <span className="mission-symbol bg-secondary" aria-hidden="true"><UsersRound /></span>
              <p className="mission-eyebrow">Groups of mates</p>
              <h3 id="mates-title">Stay in touch between meet-ups.</h3>
              <p>Sports teams. Pub quiz teams. School mates.</p>
            </div>
            <div>
              <p>Create a shared group, check in with one tap and see when your mates last checked in. Send a NUJ to let someone know you're thinking of them. No group-chat conversation to keep up with.</p>
              <p className="mission-audience-value">Keep in touch between games, quizzes or reunions, so it's easier to arrange the next one.</p>
              <a href={APP_STORE_URL} className="mission-text-link">Get NUJ for iPhone <ArrowRight size={18} aria-hidden="true" /></a>
            </div>
          </section>

          <section id="community-groups" className="mission-audience" aria-labelledby="community-groups-title">
            <div>
              <span className="mission-symbol bg-emerald-50" aria-hidden="true"><Heart /></span>
              <p className="mission-eyebrow">Community and support groups</p>
              <h3 id="community-groups-title">Keep your group connected between meet-ups.</h3>
              <p>Walk-and-talk groups, loneliness charities, community organisations and social care groups.</p>
            </div>
            <div>
              <p>Invite participants to an optional NUJ shared group. They can check in, see who's around and stay in touch without needing to start a conversation.</p>
              <p className="mission-audience-value">You bring people together. NUJ helps them maintain those connections until the next meet-up.</p>
              <a href="mailto:charlie@nuj.social?subject=Community%20pilot" className="mission-text-link">Explore a community pilot <ArrowRight size={18} aria-hidden="true" /></a>
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
              <p>Join NUJ as a venue partner to help people meet up at your venue. Offer an incentive, such as discounted coffee for a group, to make choosing your venue easier.</p>
              <p className="mission-audience-value">Give mates a reason to meet. Bring more people through your door.</p>
              <p>Venues can take part in a trial. Venue offers are not live yet.</p>
              <a href="mailto:charlie@nuj.social?subject=Venue%20pilot" className="mission-text-link">Join NUJ as a venue <ArrowRight size={18} aria-hidden="true" /></a>
            </div>
          </section>

          <p className="mission-section-intro">Trials will test whether NUJ helps people stay connected and meet up. These are not proven outcomes or announced partnerships.</p>
        </section>

        <section className="mission-belief" aria-labelledby="belief-title">
          <div className="mission-container">
            <h2 id="belief-title">Get NUJ for iPhone</h2>
            <a href={APP_STORE_URL} className="mission-button">Download on the App Store <ArrowRight size={18} aria-hidden="true" /></a>
          </div>
        </section>

        <aside className="mission-sources mission-container" aria-labelledby="sources-title">
          <h2 id="sources-title">About loneliness</h2>
          <p>Informed by <a href="https://www.marmaladetrust.org/loneliness">Marmalade Trust's loneliness resources</a> and their <a href="https://www.marmaladetrust.org/quickguidetoloneliness">quick guide to loneliness</a>. No partnership or endorsement is implied.</p>
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
