import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Contexta — Your Server\'s Memory';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a0612 0%, #1a0e2e 40%, #120a22 70%, #0d0b1a 100%)',
          position: 'relative',
        }}
      >
        {/* Purple glow */}
        <div
          style={{
            position: 'absolute',
            top: '80px',
            left: '200px',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(124,58,237,0.25) 0%, transparent 70%)',
          }}
        />
        {/* Cyan glow */}
        <div
          style={{
            position: 'absolute',
            bottom: '60px',
            right: '180px',
            width: '350px',
            height: '350px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(6,182,212,0.2) 0%, transparent 70%)',
          }}
        />

        {/* Brain icon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '80px',
            height: '80px',
            borderRadius: '24px',
            background: 'linear-gradient(135deg, rgba(124,58,237,0.3) 0%, rgba(6,182,212,0.15) 100%)',
            border: '1px solid rgba(124,58,237,0.3)',
            fontSize: '40px',
            marginBottom: '24px',
          }}
        >
          🧠
        </div>

        {/* Title */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <div
            style={{
              fontSize: '64px',
              fontWeight: 800,
              color: '#e8e0f0',
              letterSpacing: '-2px',
              lineHeight: 1.1,
            }}
          >
            Your server&apos;s
          </div>
          <div
            style={{
              fontSize: '64px',
              fontWeight: 800,
              letterSpacing: '-2px',
              lineHeight: 1.1,
              background: 'linear-gradient(90deg, #7c3aed, #a78bfa, #06b6d4)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            memory.
          </div>
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: '22px',
            color: '#9585b0',
            marginTop: '24px',
            maxWidth: '600px',
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          An AI Discord bot that remembers conversations, learns your community, and builds knowledge over time.
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: '#6b5a85',
            fontSize: '18px',
          }}
        >
          <span style={{ color: '#7c3aed', fontWeight: 700 }}>contexta</span>
          <span>·</span>
          <span>Discord Bot</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
