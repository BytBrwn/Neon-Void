import React, { useCallback, useState } from "react";
import { Background } from "./Background.js";
import {
  features,
  navLinks,
  stats,
  steps,
  testimonials,
  type PanelId,
} from "./content.js";

const panelOrder: PanelId[] = [
  "hero",
  "features",
  "about",
  "showcase",
  "contact",
];

export const SitePage: React.FC = () => {
  const [activePanel, setActivePanel] = useState<PanelId>("hero");
  const [slideDirection, setSlideDirection] = useState<"left" | "right">("right");

  const goToPanel = useCallback(
    (id: PanelId) => {
      const prevIndex = panelOrder.indexOf(activePanel);
      const nextIndex = panelOrder.indexOf(id);
      setSlideDirection(nextIndex >= prevIndex ? "right" : "left");
      setActivePanel(id);
    },
    [activePanel],
  );

  return (
    <div className="site">
      <Background />

      <header className="site-header">
        <nav className="site-nav" aria-label="Primary">
          <button
            className="site-logo"
            type="button"
            onClick={() => goToPanel("hero")}
          >
            Catalyx
          </button>
          <ul className="site-nav__links">
            {navLinks.map((link) => (
              <li key={link.id}>
                <button
                  type="button"
                  className={
                    activePanel === link.id ? "site-nav__link is-active" : "site-nav__link"
                  }
                  aria-current={activePanel === link.id ? "page" : undefined}
                  onClick={() => goToPanel(link.id)}
                >
                  {link.label}
                </button>
              </li>
            ))}
          </ul>
          <button
            className="site-nav__cta"
            type="button"
            onClick={() => goToPanel("contact")}
          >
            Get Started
          </button>
        </nav>
      </header>

      <main className="site-main">
        <div className="panel-stage">
          <div
            key={activePanel}
            className={`panel-box glass-panel panel-box--${activePanel} panel-box--from-${slideDirection}`}
          >
            {activePanel === "hero" && (
              <div className="hero-block">
                <div className="hero-block__intro">
                  <p className="eyebrow">Catalyx Widgets</p>
                  <h1 className="hero-title shimmer-text">Welcome</h1>
                  <p className="hero-lead">
                    Tap the nav — the glass panel slides and morphs horizontally
                    to reveal each section.
                  </p>
                  <div className="hero-actions">
                    <button
                      className="btn btn--primary"
                      type="button"
                      onClick={() => goToPanel("features")}
                    >
                      Explore Features
                    </button>
                    <button
                      className="btn btn--ghost"
                      type="button"
                      onClick={() => goToPanel("contact")}
                    >
                      Contact Us
                    </button>
                  </div>
                </div>
                <div className="hero-block__metrics">
                  {stats.map((stat) => (
                    <div className="hero-metric" key={stat.label}>
                      <span className="hero-metric__value">{stat.value}</span>
                      <span className="hero-metric__label">{stat.label}</span>
                    </div>
                  ))}
                </div>
                <div className="hero-glow" aria-hidden="true" />
              </div>
            )}

            {activePanel === "features" && (
              <div className="panel-layout panel-layout--features">
                <div className="panel-layout__intro">
                  <p className="eyebrow">Capabilities</p>
                  <h2 className="section-title">Everything you need</h2>
                  <p className="section-copy">
                    Ship polished widget experiences inside Foundry Workshop.
                  </p>
                </div>
                <div className="feature-grid">
                  {features.map((feature) => (
                    <article className="feature-card" key={feature.title}>
                      <span className="feature-card__icon" aria-hidden="true">
                        {feature.icon}
                      </span>
                      <div>
                        <h3>{feature.title}</h3>
                        <p>{feature.description}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {activePanel === "about" && (
              <div className="panel-layout panel-layout--about about-grid">
                <div className="about-copy">
                  <p className="eyebrow">About</p>
                  <h2 className="section-title">Built for the data stack</h2>
                  <p>
                    Catalyx Widgets bridges design and ontology-backed apps. One
                    widget can deliver a full branded experience in Foundry.
                  </p>
                  <ul className="about-list">
                    <li>Wide horizontal panel layouts</li>
                    <li>Animated box transitions between sections</li>
                    <li>OSDK-connected business logic</li>
                  </ul>
                </div>
                <div className="about-visual">
                  <p className="about-visual__label">Live Preview</p>
                  <h3>One widget. Entire journey.</h3>
                  <div className="about-visual__stats">
                    {stats.slice(0, 3).map((stat) => (
                      <div key={stat.label}>
                        <strong>{stat.value}</strong>
                        <span>{stat.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activePanel === "showcase" && (
              <div className="panel-layout panel-layout--showcase">
                <div className="panel-layout__intro">
                  <p className="eyebrow">Showcase</p>
                  <h2 className="section-title">Idea to production</h2>
                </div>
                <div className="steps-grid">
                  {steps.map((item) => (
                    <article className="step-card" key={item.step}>
                      <span className="step-card__number">{item.step}</span>
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                    </article>
                  ))}
                </div>
                <div className="testimonial-grid">
                  {testimonials.map((item) => (
                    <blockquote className="testimonial" key={item.author}>
                      <p>&ldquo;{item.quote}&rdquo;</p>
                      <footer>
                        <strong>{item.author}</strong>
                        <span>{item.role}</span>
                      </footer>
                    </blockquote>
                  ))}
                </div>
              </div>
            )}

            {activePanel === "contact" && (
              <div className="panel-layout panel-layout--contact contact-grid">
                <div className="contact-copy">
                  <p className="eyebrow">Contact</p>
                  <h2 className="section-title">Build your widget</h2>
                  <p>
                    Tell us about your use case. Wire this form to an OSDK action
                    in production.
                  </p>
                  <div className="contact-details">
                    <div>
                      <span>Email</span>
                      <strong>hello@catalyx.dev</strong>
                    </div>
                    <div>
                      <span>Location</span>
                      <strong>Global · Remote first</strong>
                    </div>
                  </div>
                </div>
                <form
                  className="contact-form"
                  onSubmit={(e) => e.preventDefault()}
                >
                  <div className="contact-form__row">
                    <label>
                      Name
                      <input type="text" name="name" placeholder="Your name" />
                    </label>
                    <label>
                      Email
                      <input type="email" name="email" placeholder="you@company.com" />
                    </label>
                  </div>
                  <label>
                    Message
                    <textarea
                      name="message"
                      rows={2}
                      placeholder="Your widget idea..."
                    />
                  </label>
                  <button className="btn btn--primary" type="submit">
                    Send Message
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="site-footer">
        <div className="site-footer__inner">
          <p className="site-footer__copy">
            © {new Date().getFullYear()} Catalyx Widgets — panel-based demo
          </p>
        </div>
      </footer>
    </div>
  );
};
