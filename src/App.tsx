import { useEffect } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import logo from './assets/privatecoder-logo.png';
import { Home } from './pages/Home';
import { Tool } from './pages/Tool';

export function App() {
  // Scroll reveal for elements with .reveal class.
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      document.querySelectorAll<HTMLElement>('.reveal').forEach((el) => {
        el.classList.add('reveal-visible');
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add('reveal-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 },
    );

    document.querySelectorAll<HTMLElement>('.reveal').forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="page">
      <nav className="top-nav">
        <div className="top-nav-inner">
          <Link to="/" className="logo-button">
            <img src={logo} alt="PRIVATECODER" className="logo-mark logo-mark-nav" />
            <span className="top-nav-title">PRIVATECODER</span>
          </Link>
          <span className="demo-badge">🟢 LIVE DEMO MODE · Running Fully Offline</span>
        </div>
      </nav>


      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tool" element={<Tool />} />
      </Routes>
    </div>
  );
}
