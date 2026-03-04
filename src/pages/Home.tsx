import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/privatecoder-logo.png';
import { getModel } from '../modelManager';

export function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    // Silent background preload while user reads the landing page.
    void getModel().catch(() => {});
  }, []);

  const handleTryNow = useCallback(() => {
    navigate('/tool');
  }, [navigate]);

  return (
    <>
      <section id="hero" className="hero">
        <div className="hero-inner reveal reveal-visible">
          <img src={logo} alt="PRIVATECODER" className="logo-mark hero-logo" />
          <h1 className="hero-title">PRIVATECODER</h1>
          <p className="hero-tagline">Engineering Intelligence. Fully Offline.</p>
          <p className="hero-subtitle">On-Device Development Toolkit</p>
          <div className="hero-badges">
            <span className="hero-badge">⚡ 5s Inference</span>
            <span className="hero-badge">🔒 Fully Private</span>
            <span className="hero-badge">🧠 On-Device LLM</span>
            <span className="hero-badge">📴 Works Offline</span>
          </div>
          <button className="btn btn-primary hero-cta" type="button" onClick={handleTryNow}>
            Try It Now
          </button>
        </div>
      </section>

      <section className="features">
        <div className="features-inner reveal">
          <h2 className="section-title">Why On-Device AI Matters</h2>
          <div className="features-grid">
            <article className="feature-card">
              <h3>100% Private</h3>
              <p>All inference runs locally in your browser. No data leaves your machine.</p>
            </article>
            <article className="feature-card">
              <h3>Zero API Cost</h3>
              <p>No OpenAI, no backend, no token billing. Fully self-contained AI.</p>
            </article>
            <article className="feature-card">
              <h3>Works Without Internet</h3>
              <p>Disconnect WiFi and continue coding. True offline intelligence.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="architecture reveal">
        <div className="architecture-inner">
          <h2 className="section-title">System Architecture</h2>
          <div className="architecture-stack">
            <div className="arch-block">React + Vite Frontend</div>
            <div className="arch-arrow">↓</div>
            <div className="arch-block">RunAnywhere Web SDK</div>
            <div className="arch-arrow">↓</div>
            <div className="arch-block">LFM2 350M Q4_K_M On-Device LLM</div>
            <div className="arch-arrow">↓</div>
            <div className="arch-block">WebGPU Acceleration</div>
          </div>
          <p className="architecture-subtitle">All inference happens locally in the browser.</p>
          <div className="metric-bar">
            <div className="metric-bar-item">
              <span className="metric-bar-value">4.8s</span>
              <span className="metric-bar-label">⚡ Avg Inference</span>
            </div>
            <div className="metric-bar-item">
              <span className="metric-bar-value">0 bytes</span>
              <span className="metric-bar-label">🔒 Data Sent to Server</span>
            </div>
            <div className="metric-bar-item">
              <span className="metric-bar-value">₹0</span>
              <span className="metric-bar-label">💰 API Cost</span>
            </div>
          </div>
        </div>
      </section>

      <section className="performance-transparency reveal">
        <div className="performance-transparency-inner">
          <h2 className="section-title">Performance Transparency</h2>
          <p className="performance-transparency-subtitle">Realistic loading expectations for on-device AI.</p>
          <div className="performance-transparency-grid">
            <article className="performance-card">
              <h3 className="performance-card-title">First Ever Load</h3>
              <p className="performance-card-desc">Download (~250MB GGUF) + compile locally.</p>
              <p className="performance-card-time">Expected time: <strong>30–60s</strong> (network dependent)</p>
            </article>
            <article className="performance-card">
              <h3 className="performance-card-title">Second Load (Cached)</h3>
              <p className="performance-card-desc">Model stored locally in browser (OPFS).</p>
              <p className="performance-card-time">Expected time: <strong>5–12s</strong></p>
            </article>
            <article className="performance-card">
              <h3 className="performance-card-title">Navigate Back to Tool</h3>
              <p className="performance-card-desc">Model already in memory.</p>
              <p className="performance-card-time">Expected time: <strong>Instant</strong></p>
            </article>
          </div>
        </div>
      </section>

      <section className="comparison reveal">
        <div className="comparison-inner">
          <h2 className="section-title">PRIVATECODER vs Traditional AI Tools</h2>
          <div className="comparison-table">
            <div className="comparison-header">
              <div className="comparison-cell comparison-label" />
              <div className="comparison-cell">Traditional</div>
              <div className="comparison-cell comparison-highlight">PRIVATECODER</div>
            </div>
            <div className="comparison-row">
              <div className="comparison-cell comparison-label">Requires Internet</div>
              <div className="comparison-cell">Yes</div>
              <div className="comparison-cell comparison-highlight">No</div>
            </div>
            <div className="comparison-row">
              <div className="comparison-cell comparison-label">API Cost</div>
              <div className="comparison-cell">Yes</div>
              <div className="comparison-cell comparison-highlight">Zero</div>
            </div>
            <div className="comparison-row">
              <div className="comparison-cell comparison-label">Data Leaves Device</div>
              <div className="comparison-cell">Yes</div>
              <div className="comparison-cell comparison-highlight">No</div>
            </div>
            <div className="comparison-row">
              <div className="comparison-cell comparison-label">Offline Support</div>
              <div className="comparison-cell">No</div>
              <div className="comparison-cell comparison-highlight">Yes</div>
            </div>
            <div className="comparison-row">
              <div className="comparison-cell comparison-label">Runs During Network Outage</div>
              <div className="comparison-cell">❌</div>
              <div className="comparison-cell comparison-highlight">✅</div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

