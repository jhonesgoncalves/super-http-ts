---
layout: page
title: About the Author
description: Jhones Gonçalves — Staff Software Engineer, Software Architect, and creator of super-http.
---

<style>
.author-page {
  max-width: 860px;
  margin: 0 auto;
  padding: 48px 24px 80px;
}

/* ─── Hero ─────────────────────────────────────────────────────── */
.author-hero {
  display: flex;
  align-items: center;
  gap: 40px;
  padding: 48px 40px;
  border-radius: 20px;
  background: linear-gradient(135deg, var(--vp-c-brand-soft) 0%, transparent 60%);
  border: 1px solid var(--vp-c-border);
  margin-bottom: 48px;
}

.author-avatar {
  flex-shrink: 0;
  width: 140px;
  height: 140px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid var(--vp-c-brand-1);
  box-shadow: 0 8px 32px rgba(0,0,0,.18);
}

.author-hero-text h1 {
  font-size: 2rem;
  font-weight: 800;
  margin: 0 0 6px;
  background: linear-gradient(135deg, var(--vp-c-brand-1), var(--vp-c-brand-2));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1.2;
  border-top: none;
  padding-top: 0;
}

.author-hero-text .author-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--vp-c-text-2);
  margin: 0 0 6px;
  letter-spacing: .01em;
}

.author-location {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: .85rem;
  color: var(--vp-c-text-3);
  margin-bottom: 16px;
}

.author-hero-links {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 4px;
}

.author-hero-links a {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: .8rem;
  font-weight: 600;
  text-decoration: none;
  transition: all .2s;
  border: 1.5px solid var(--vp-c-border);
  color: var(--vp-c-text-1);
}

.author-hero-links a:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  transform: translateY(-1px);
}

/* ─── Stats row ────────────────────────────────────────────────── */
.author-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 48px;
}

.stat-card {
  padding: 20px 16px;
  border-radius: 14px;
  border: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg-soft);
  text-align: center;
  transition: border-color .2s, transform .2s;
}

.stat-card:hover {
  border-color: var(--vp-c-brand-1);
  transform: translateY(-2px);
}

.stat-number {
  font-size: 1.8rem;
  font-weight: 800;
  color: var(--vp-c-brand-1);
  line-height: 1;
  margin-bottom: 4px;
}

.stat-label {
  font-size: .75rem;
  color: var(--vp-c-text-2);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: .06em;
}

/* ─── Sections ─────────────────────────────────────────────────── */
.author-section {
  margin-bottom: 48px;
}

.section-label {
  display: inline-block;
  font-size: .7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .1em;
  color: var(--vp-c-brand-1);
  margin-bottom: 8px;
}

.author-section h2 {
  font-size: 1.35rem;
  font-weight: 700;
  margin: 0 0 16px;
  padding: 0;
  border: none;
}

.author-section p {
  font-size: .97rem;
  line-height: 1.75;
  color: var(--vp-c-text-2);
  margin: 0 0 12px;
}

/* ─── Quote / mission ──────────────────────────────────────────── */
.author-mission {
  position: relative;
  padding: 28px 32px;
  border-radius: 16px;
  background: var(--vp-c-brand-soft);
  border-left: 4px solid var(--vp-c-brand-1);
  margin-bottom: 48px;
}

.author-mission blockquote {
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
}

.author-mission p {
  font-size: 1.08rem;
  line-height: 1.7;
  font-style: italic;
  color: var(--vp-c-text-1);
  margin: 0;
}

.author-mission .mission-label {
  font-size: .7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .1em;
  color: var(--vp-c-brand-1);
  margin-bottom: 8px;
}

/* ─── Skills / tags ─────────────────────────────────────────────── */
.tag-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.tag {
  padding: 6px 14px;
  border-radius: 999px;
  font-size: .8rem;
  font-weight: 600;
  border: 1.5px solid var(--vp-c-border);
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-soft);
  transition: all .2s;
}

.tag:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.tag.highlight {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

/* ─── Timeline ──────────────────────────────────────────────────── */
.timeline {
  position: relative;
  padding-left: 28px;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 7px;
  top: 6px;
  bottom: 0;
  width: 2px;
  background: linear-gradient(to bottom, var(--vp-c-brand-1), transparent);
  border-radius: 2px;
}

.timeline-item {
  position: relative;
  margin-bottom: 28px;
}

.timeline-item::before {
  content: '';
  position: absolute;
  left: -24px;
  top: 6px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--vp-c-brand-1);
  background: var(--vp-c-bg);
}

.timeline-item.current::before {
  background: var(--vp-c-brand-1);
}

.timeline-date {
  font-size: .75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .07em;
  color: var(--vp-c-brand-1);
  margin-bottom: 4px;
}

.timeline-role {
  font-size: .97rem;
  font-weight: 700;
  color: var(--vp-c-text-1);
  margin-bottom: 2px;
}

.timeline-company {
  font-size: .88rem;
  color: var(--vp-c-text-2);
  margin-bottom: 4px;
}

.timeline-desc {
  font-size: .85rem;
  color: var(--vp-c-text-3);
  line-height: 1.6;
}

/* ─── Open source card ──────────────────────────────────────────── */
.oss-card {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 28px 32px;
  border-radius: 16px;
  border: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg-soft);
  margin-bottom: 48px;
  transition: border-color .2s, transform .2s;
}

.oss-card:hover {
  border-color: var(--vp-c-brand-1);
  transform: translateY(-2px);
}

.oss-icon {
  font-size: 2.5rem;
  flex-shrink: 0;
}

.oss-card h3 {
  font-size: 1.05rem;
  font-weight: 700;
  margin: 0 0 6px;
}

.oss-card p {
  font-size: .87rem;
  color: var(--vp-c-text-2);
  line-height: 1.6;
  margin: 0;
}

/* ─── CTA / connect ─────────────────────────────────────────────── */
.author-cta {
  text-align: center;
  padding: 48px 32px;
  border-radius: 20px;
  border: 1px solid var(--vp-c-border);
  background: linear-gradient(135deg, var(--vp-c-brand-soft) 0%, transparent 70%);
}

.author-cta h2 {
  font-size: 1.5rem;
  font-weight: 800;
  margin: 0 0 8px;
  padding: 0;
  border: none;
}

.author-cta p {
  font-size: .95rem;
  color: var(--vp-c-text-2);
  margin: 0 0 28px;
}

.cta-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
}

.cta-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 22px;
  border-radius: 999px;
  font-size: .88rem;
  font-weight: 700;
  text-decoration: none;
  transition: all .2s;
}

.cta-btn.primary {
  background: var(--vp-c-brand-1);
  color: var(--vp-c-white);
  border: 2px solid var(--vp-c-brand-1);
}

.cta-btn.primary:hover {
  background: var(--vp-c-brand-2);
  border-color: var(--vp-c-brand-2);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0,0,0,.15);
}

.cta-btn.secondary {
  border: 2px solid var(--vp-c-border);
  color: var(--vp-c-text-1);
  background: transparent;
}

.cta-btn.secondary:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  transform: translateY(-2px);
}

/* ─── Responsive ─────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .author-hero {
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 32px 24px;
  }

  .author-hero-links {
    justify-content: center;
  }

  .author-stats {
    grid-template-columns: repeat(2, 1fr);
  }

  .oss-card {
    flex-direction: column;
    text-align: center;
  }
}
</style>

<div class="author-page">

  <!-- ─── Hero ─────────────────────────────────────── -->
  <div class="author-hero">
    <img
      class="author-avatar"
      src="https://jhonesgoncalves.com/assets/jhones-CdflzHxT.jpg"
      alt="Jhones Gonçalves"
    />
    <div class="author-hero-text">
      <h1>Jhones Gonçalves</h1>
      <div class="author-title">Staff Software Engineer &amp; Software Architect</div>
      <div class="author-location">
        📍 São Paulo, Brazil
      </div>
      <div class="author-hero-links">
        <a href="https://jhonesgoncalves.com" target="_blank" rel="noopener">
          🌐 Website
        </a>
        <a href="https://github.com/jhonesgoncalves" target="_blank" rel="noopener">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
          GitHub
        </a>
        <a href="https://linkedin.com/in/jhonesgoncalves" target="_blank" rel="noopener">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          LinkedIn
        </a>
        <a href="https://dev.to/jhonesgoncalves" target="_blank" rel="noopener">
          ✍️ DEV.to
        </a>
      </div>
    </div>
  </div>

  <!-- ─── Stats ─────────────────────────────────────── -->
  <div class="author-stats">
    <div class="stat-card">
      <div class="stat-number">8+</div>
      <div class="stat-label">Years of Experience</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">∞M</div>
      <div class="stat-label">Events / Day</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">Staff</div>
      <div class="stat-label">Engineer Level</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">OSS</div>
      <div class="stat-label">Open Source Contributor</div>
    </div>
  </div>

  <!-- ─── About ─────────────────────────────────────── -->
  <div class="author-section">
    <span class="section-label">About</span>
    <h2>The person behind super-http</h2>
    <p>
      I'm a Software Architect and Staff Software Engineer passionate about distributed systems,
      cloud-native architectures, developer experience, and high-performance applications.
      With 8+ years designing backend platforms serving millions of users, I combine deep technical
      execution with product and business alignment.
    </p>
    <p>
      Throughout my career I've designed and built scalable systems, modernised legacy architectures,
      and helped engineering teams ship reliable software at scale — from high-frequency financial
      platforms at <strong>XP Investments</strong> to event-driven distributed systems at <strong>Stix</strong>.
    </p>
    <p>
      <strong>super-http</strong> was born from a recurring challenge across multiple Node.js and TypeScript
      projects: every team was rebuilding the same resilience patterns from scratch.
      Inspired by proven concepts from the .NET ecosystem — <em>HttpClientFactory</em> and <em>Polly</em> —
      I created super-http to bring those battle-tested patterns into a modern TypeScript-first experience.
    </p>
  </div>

  <!-- ─── Mission ───────────────────────────────────── -->
  <div class="author-mission">
    <div class="mission-label">Mission</div>
    <blockquote>
      <p>
        Build resilient communication layers for TypeScript applications so teams can focus
        on business problems instead of infrastructure boilerplate.
      </p>
    </blockquote>
  </div>

  <!-- ─── Expertise ─────────────────────────────────── -->
  <div class="author-section">
    <span class="section-label">Expertise</span>
    <h2>Areas of focus</h2>
    <div class="tag-grid">
      <span class="tag highlight">Software Architecture</span>
      <span class="tag highlight">Distributed Systems</span>
      <span class="tag highlight">TypeScript</span>
      <span class="tag highlight">NestJS</span>
      <span class="tag">Event-Driven Architecture</span>
      <span class="tag">Cloud-Native Applications</span>
      <span class="tag">High-Performance Backends</span>
      <span class="tag">Developer Experience</span>
      <span class="tag">Engineering Leadership</span>
      <span class="tag">Kafka / RabbitMQ</span>
      <span class="tag">Azure / Kubernetes</span>
      <span class="tag">DDD / CQRS / Event Sourcing</span>
      <span class="tag">gRPC</span>
      <span class="tag">C# / .NET</span>
      <span class="tag">Microservices</span>
    </div>
  </div>

  <!-- ─── Experience ────────────────────────────────── -->
  <div class="author-section">
    <span class="section-label">Experience</span>
    <h2>Career timeline</h2>
    <div class="timeline">
      <div class="timeline-item current">
        <div class="timeline-date">Feb 2023 — Present</div>
        <div class="timeline-role">Staff Software Engineer</div>
        <div class="timeline-company">Stix</div>
        <div class="timeline-desc">
          Distributed system architecture, scalability, resilience, and event-driven solutions
          processing millions of events daily.
        </div>
      </div>
      <div class="timeline-item">
        <div class="timeline-date">2020 — 2023</div>
        <div class="timeline-role">Senior Software Engineer</div>
        <div class="timeline-company">XP Investments</div>
        <div class="timeline-desc">
          Financial software with .NET and React. High-availability systems for one of
          Brazil's largest investment platforms.
        </div>
      </div>
      <div class="timeline-item">
        <div class="timeline-date">2019 — Present</div>
        <div class="timeline-role">Technology Teacher &amp; Mentor</div>
        <div class="timeline-company">Superprof &amp; Independent</div>
        <div class="timeline-desc">
          Mentorship programs from Zero-to-Developer through Tech Lead-to-Staff Engineer.
          Teaches C#, TypeScript, React, and DevOps.
        </div>
      </div>
      <div class="timeline-item">
        <div class="timeline-date">2018 — 2020</div>
        <div class="timeline-role">Software Consultant &amp; Full Stack Developer</div>
        <div class="timeline-company">Various companies</div>
        <div class="timeline-desc">
          DevOps engineering, full-stack development, and architecture consulting across
          multiple industries.
        </div>
      </div>
    </div>
  </div>

  <!-- ─── Open Source ───────────────────────────────── -->
  <div class="oss-card">
    <div class="oss-icon">⚡</div>
    <div>
      <h3>super-http — Open Source</h3>
      <p>
        I strongly believe in sharing knowledge and contributing back to the developer community.
        super-http is one of those contributions — a production-grade, TypeScript-first HTTP client
        with a full resilience pipeline built in. It continues to evolve through community feedback
        and real-world usage. Contributions, issues and ideas are always welcome.
      </p>
    </div>
  </div>

  <!-- ─── CTA / Connect ─────────────────────────────── -->
  <div class="author-cta">
    <h2>Let's connect</h2>
    <p>
      Feel free to reach out, share feedback, suggest improvements, or contribute to the project.
    </p>
    <div class="cta-links">
      <a class="cta-btn primary" href="https://jhonesgoncalves.com" target="_blank" rel="noopener">
        🌐 jhonesgoncalves.com
      </a>
      <a class="cta-btn secondary" href="https://github.com/jhonesgoncalves/super-http-ts" target="_blank" rel="noopener">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
        GitHub
      </a>
      <a class="cta-btn secondary" href="https://linkedin.com/in/jhonesgoncalves" target="_blank" rel="noopener">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
        LinkedIn
      </a>
      <a class="cta-btn secondary" href="https://dev.to/jhonesgoncalves" target="_blank" rel="noopener">
        ✍️ DEV.to
      </a>
    </div>
  </div>

</div>
