import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Landing.css";

const useInView = (options = {}) => {
  const ref = useRef(null);
  const [isVisible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.unobserve(el); } },
      { threshold: 0.15, ...options }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, isVisible];
};

const Reveal = ({ children, className = "", delay = 0 }) => {
  const [ref, visible] = useInView();
  return (
    <div ref={ref} className={`gl-reveal ${visible ? "visible" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
};

const Landing = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const features = [
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      ),
      title: "Real-time Messaging",
      desc: "Instant message delivery via Supabase Realtime. No polling, no lag — conversations flow naturally.",
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="23 7 16 12 23 17 23 7"/>
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
        </svg>
      ),
      title: "Video & Audio Calls",
      desc: "Crystal-clear HD calls powered by ZEGOCLOUD. One click to connect face-to-face.",
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
      title: "Presence & Typing",
      desc: "Live online status and typing indicators so you always know when someone is engaged.",
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      ),
      title: "Secure by Design",
      desc: "Supabase Auth with email/password and Google OAuth. Row-level security on every query.",
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
      ),
      title: "Media Sharing",
      desc: "Send images and files inline. Assets upload to Supabase Storage and render in chat.",
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      ),
      title: "Dark & Light Themes",
      desc: "System-aware theming with manual override. Your preference persists across sessions.",
    },
  ];

  const steps = [
    { num: "01", title: "Create Account", desc: "Sign up with email or Google OAuth in seconds." },
    { num: "02", title: "Find People", desc: "Search users and start conversations instantly." },
    { num: "03", title: "Start Chatting", desc: "Messages delivered in real-time with typing indicators." },
    { num: "04", title: "Go Live", desc: "One-click video and audio calls — no setup needed." },
  ];

  const stack = [
    { name: "React", desc: "Component-driven UI" },
    { name: "Vite", desc: "Fast build tooling" },
    { name: "Supabase", desc: "Auth, DB, Realtime, Storage" },
    { name: "ZEGOCLOUD", desc: "Video & audio SDK" },
    { name: "AWS Lambda", desc: "Serverless token generation" },
    { name: "CloudFront", desc: "Global CDN delivery" },
  ];

  return (
    <div className="gl-landing">
      {/* Navbar */}
      <nav className={`gl-nav ${scrolled ? "scrolled" : ""}`}>
        <div className="gl-nav-inner">
          <a href="/" className="gl-nav-logo">
            <img src="/logo-icon.svg" alt="Chatly" />
            <span>Chatly</span>
          </a>
          <div className={`gl-nav-links ${menuOpen ? "open" : ""}`}>
            <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
            <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How It Works</a>
            <a href="#stack" onClick={() => setMenuOpen(false)}>Stack</a>
            <button className="gl-nav-cta" onClick={() => { setMenuOpen(false); navigate("/login"); }}>
              Launch App
            </button>
          </div>
          <button className="gl-mobile-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {menuOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </>
              ) : (
                <>
                  <line x1="3" y1="12" x2="21" y2="12"/>
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <line x1="3" y1="18" x2="21" y2="18"/>
                </>
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="gl-hero">
        <div className="gl-hero-glow" />
        <div className="gl-hero-content">
          <div className="gl-hero-text">
            <p className="gl-hero-label">Real-time chat platform</p>
            <h1>Conversations<br />that feel <em>alive</em></h1>
            <p className="gl-hero-sub">
              A full-stack messaging platform with video calls, presence tracking,
              and instant delivery — crafted with React &amp; Supabase.
            </p>
            <div className="gl-hero-actions">
              <button className="gl-btn-primary" onClick={() => navigate("/login")}>
                Get Started
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              </button>
              <a className="gl-btn-ghost" href="#features">Explore Features</a>
            </div>
          </div>

          <div className="gl-hero-preview">
            <div className="gl-chat-mock">
              <div className="gl-mock-header">
                <div className="gl-mock-avatar">AV</div>
                <div className="gl-mock-info">
                  <span className="gl-mock-name">Alok Vadera</span>
                  <span className="gl-mock-status">Online</span>
                </div>
              </div>
              <div className="gl-mock-messages">
                <div className="gl-mock-msg received">
                  Hey! Have you tried the video calling? 🎥
                  <span className="gl-mock-time">2:34 PM</span>
                </div>
                <div className="gl-mock-msg sent">
                  Yes! Crystal clear quality 🔥
                  <span className="gl-mock-time">2:35 PM</span>
                </div>
                <div className="gl-mock-msg received">
                  Real-time messaging is so fast!
                  <span className="gl-mock-time">2:35 PM</span>
                </div>
                <div className="gl-mock-msg sent">
                  Supabase Realtime makes it instant ⚡
                  <span className="gl-mock-time">2:36 PM</span>
                </div>
                <div className="gl-mock-typing">
                  <span /><span /><span />
                </div>
              </div>
              <div className="gl-mock-input">
                <div className="gl-mock-input-field">Type a message...</div>
                <div className="gl-mock-send">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F5F0E6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="gl-section" id="features">
        <Reveal>
          <div className="gl-section-header">
            <span className="gl-section-tag">Features</span>
            <h2>Everything you need to connect</h2>
            <p>Built for real-time communication — messaging, video, presence, and security in one seamless experience.</p>
          </div>
        </Reveal>
        <div className="gl-features-grid">
          {features.map((f, i) => (
            <Reveal key={i} delay={i * 80}>
              <div className="gl-feature-card">
                <div className="gl-feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Realtime */}
      <section className="gl-section gl-realtime" id="realtime">
        <div className="gl-realtime-inner">
          <Reveal>
            <div className="gl-realtime-text">
              <span className="gl-section-tag">Realtime Engine</span>
              <h3>Messages delivered in milliseconds</h3>
              <p>
                Powered by Supabase Realtime WebSocket channels, every message,
                typing indicator, and presence update arrives instantly. No polling. No delays.
              </p>
              <ul className="gl-realtime-list">
                <li>WebSocket-based real-time subscriptions</li>
                <li>Live typing indicators across users</li>
                <li>Online/offline presence tracking</li>
                <li>Instant delivery confirmation</li>
              </ul>
            </div>
          </Reveal>
          <Reveal delay={200}>
            <div className="gl-realtime-visual">
              <div className="gl-pulse">
                <div className="gl-pulse-ring" />
                <div className="gl-pulse-ring" />
                <div className="gl-pulse-ring" />
                <div className="gl-pulse-core">⚡</div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* How It Works */}
      <section className="gl-section" id="how-it-works">
        <Reveal>
          <div className="gl-section-header">
            <span className="gl-section-tag">How It Works</span>
            <h2>Up and running in minutes</h2>
            <p>From sign-up to your first video call — four simple steps.</p>
          </div>
        </Reveal>
        <div className="gl-steps">
          {steps.map((s, i) => (
            <Reveal key={i} delay={i * 100}>
              <div className="gl-step">
                <span className="gl-step-num">{s.num}</span>
                <h4>{s.title}</h4>
                <p>{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Tech Stack */}
      <section className="gl-section gl-stack-section" id="stack">
        <Reveal>
          <div className="gl-section-header">
            <span className="gl-section-tag">Tech Stack</span>
            <h2>Modern tools, modern results</h2>
            <p>Built with industry-leading technologies for the best developer and user experience.</p>
          </div>
        </Reveal>
        <div className="gl-stack-grid">
          {stack.map((s, i) => (
            <Reveal key={i} delay={i * 60}>
              <div className="gl-stack-card">
                <h4>{s.name}</h4>
                <p>{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="gl-cta">
        <div className="gl-cta-glow" />
        <Reveal>
          <div className="gl-cta-content">
            <h2>Ready to start chatting?</h2>
            <p>Free, fast, and built for the way you communicate. No credit card required.</p>
            <button className="gl-btn-primary" onClick={() => navigate("/login")}>
              Launch Chatly
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </button>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="gl-footer">
        <div className="gl-footer-inner">
          <div className="gl-footer-brand">
            <a href="/" className="gl-footer-logo">
              <img src="/logo-icon.svg" alt="Chatly" />
              <span>Chatly</span>
            </a>
            <p>A real-time chat application built with React &amp; Supabase by Alok Vadera.</p>
          </div>
          <div className="gl-footer-col">
            <h5>Product</h5>
            <a href="#features">Features</a>
            <a href="#realtime">Realtime</a>
            <a href="#stack">Tech Stack</a>
          </div>
          <div className="gl-footer-col">
            <h5>Resources</h5>
            <a href="#how-it-works">How It Works</a>
            <a href="https://github.com/alokvadera" target="_blank" rel="noopener noreferrer">GitHub</a>
          </div>
          <div className="gl-footer-col">
            <h5>Connect</h5>
            <a href="https://github.com/alokvadera" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="/login">Sign In</a>
          </div>
        </div>
        <div className="gl-footer-bottom">
          <p>&copy; {new Date().getFullYear()} Chatly by Alok Vadera. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;