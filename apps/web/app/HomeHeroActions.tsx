'use client';

import Link from 'next/link';
import { trackEvent } from '@/lib/analytics';

export default function HomeHeroActions() {
  return (
    <div className="landing-hero-actions">
      <Link
        href="/plan"
        className="landing-hero-button landing-hero-button-primary"
        onClick={() => trackEvent('home_cta_clicked', { cta_id: 'hero_plan', destination: '/plan' })}
      >
        Generate My Plan
      </Link>
      <a
        href="#lead-capture"
        className="landing-hero-button landing-hero-button-secondary"
        onClick={() => trackEvent('home_cta_clicked', { cta_id: 'hero_alerts', destination: '#lead-capture' })}
      >
        Get Sponsor Alerts
      </a>
    </div>
  );
}
