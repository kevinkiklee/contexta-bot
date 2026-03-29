'use client';

import { useEffect, useRef, useState } from 'react';
import DiscordChat from './DiscordChat';
import type { ChatDay } from './DiscordChat';
import GlowBlob from './GlowBlob';
import Particles from './Particles';

const DAY_1: ChatDay = {
  label: 'Monday, March 24',
  messages: [
    { username: 'Alex', avatar: 'A', avatarColor: '#5865f2', content: 'just got back from an amazing hike at Mt. Rainier 🏔️', timestamp: '4:23 PM' },
    { username: 'Jordan', avatar: 'J', avatarColor: '#57f287', content: "jealous! I've been stuck inside all week", timestamp: '4:25 PM' },
  ],
};

const DAY_3: ChatDay = {
  label: 'Wednesday, March 26',
  messages: [
    { username: 'Jordan', avatar: 'J', avatarColor: '#57f287', content: '@Contexta any birthday gift ideas for Alex?', timestamp: '11:42 AM' },
    { username: 'Contexta', avatar: '🧠', avatarColor: '#7c3aed', content: 'Alex mentioned loving hiking at Mt. Rainier a couple days ago! Maybe a National Parks pass, a trail guide for the PNW, or some nice hiking gear? 🎁', isBot: true, timestamp: '11:42 AM' },
  ],
};

export default function SeeItInAction() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPhase(1);
          observer.unobserve(el);
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (phase === 0) return;
    if (phase === 1) {
      const t = setTimeout(() => setPhase(2), 1500);
      return () => clearTimeout(t);
    }
    if (phase === 2) {
      const t = setTimeout(() => setPhase(3), 2500);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const visibleDays: ChatDay[] = [];
  if (phase >= 1) visibleDays.push(DAY_1);
  if (phase >= 2) visibleDays.push(DAY_3);

  return (
    <section ref={sectionRef} className="relative px-6 py-32 sm:py-40 overflow-hidden">
      <div className="divider mb-24" />

      <GlowBlob color="purple" size={600} className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      <Particles count={25} color="#7c3aed" />

      <div className="relative max-w-2xl mx-auto text-center">
        <p className="text-purple text-xs font-semibold uppercase tracking-[3px] mb-3">See It In Action</p>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
          Memory that connects the dots
        </h2>
        <p className="text-text-muted mb-16 max-w-md mx-auto">
          Watch how Contexta recalls a conversation from days ago to give the perfect answer.
        </p>

        <div className="relative">
          <div
            className="transition-all duration-700"
            style={{ opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? 'translateY(0)' : 'translateY(20px)' }}
          >
            {visibleDays.length > 0 && <DiscordChat days={visibleDays} />}
          </div>

          {phase >= 3 && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ zIndex: 10 }}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="mem-line" x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="#7c3aed" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
              <path
                d="M 70 82 C 85 60, 85 40, 55 22"
                fill="none"
                stroke="url(#mem-line)"
                strokeWidth="0.4"
                opacity="0.6"
                strokeDasharray="200"
                strokeDashoffset="200"
                strokeLinecap="round"
              >
                <animate attributeName="stroke-dashoffset" from="200" to="0" dur="1s" fill="freeze" calcMode="spline" keySplines="0.4 0 0.2 1" />
              </path>
              <path
                d="M 70 82 C 85 60, 85 40, 55 22"
                fill="none"
                stroke="url(#mem-line)"
                strokeWidth="1.2"
                opacity="0.15"
                strokeDasharray="200"
                strokeDashoffset="200"
                strokeLinecap="round"
              >
                <animate attributeName="stroke-dashoffset" from="200" to="0" dur="1s" fill="freeze" calcMode="spline" keySplines="0.4 0 0.2 1" />
              </path>
              <g opacity="0">
                <animate attributeName="opacity" from="0" to="1" dur="0.3s" begin="0.8s" fill="freeze" />
                <rect x="72" y="48" width="22" height="7" rx="3.5" fill="#7c3aed" fillOpacity="0.2" stroke="#7c3aed" strokeOpacity="0.4" strokeWidth="0.2" />
                <text x="83" y="53" textAnchor="middle" fill="#a78bfa" fontSize="3" fontFamily="var(--font-sans)">memory</text>
              </g>
            </svg>
          )}
        </div>
      </div>
    </section>
  );
}
