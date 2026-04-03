import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '36px',
          background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
          color: 'white',
          fontSize: '100px',
          fontWeight: 800,
        }}
      >
        C
      </div>
    ),
    { ...size },
  );
}
