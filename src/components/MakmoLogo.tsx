import React, { useState } from 'react';

export const PCM_NEXUS_BRAND = {
  navy: '#133863', // Azul Marinho Oficial PCM NEXUS
  teal: '#20bdae', // Verde Água / Turquesa Oficial PCM NEXUS
  white: '#ffffff',
  navyDark: '#0d2746',
  navyLight: '#1b4d82',
  tealLight: '#2dd4c4',
  tealDark: '#178a7f',
};

// Aliased for backwards compatibility
export const MAKMO_BRAND = PCM_NEXUS_BRAND;

interface MakmoLogoProps {
  className?: string;
  theme?: 'light' | 'dark' | 'auto' | 'brand';
  showSubtitle?: boolean;
  showSubBrand?: boolean;
  compact?: boolean;
  preferOfficialImage?: boolean;
}

const GEAR_PATH =
  'M 123.95 28.67 L 146.05 28.67 L 143.65 48.52 L 163.25 53.77 L 171.10 35.38 L 190.24 46.43 L 178.23 62.42 L 192.58 76.77 L 208.57 64.76 L 219.62 83.90 L 201.23 91.75 L 206.48 111.35 L 226.33 108.95 L 226.33 131.05 L 206.48 128.65 L 201.23 148.25 L 219.62 156.10 L 208.57 175.24 L 192.58 163.23 L 178.23 177.58 L 190.24 193.57 L 171.10 204.62 L 163.25 186.23 L 143.65 191.48 L 146.05 211.33 L 123.95 211.33 L 126.35 191.48 L 106.75 186.23 L 98.90 204.62 L 79.76 193.57 L 91.77 177.58 L 77.42 163.23 L 61.43 175.24 L 50.38 156.10 L 68.77 148.25 L 63.52 128.65 L 43.67 131.05 L 43.67 108.95 L 63.52 111.35 L 68.77 91.75 L 50.38 83.90 L 61.43 64.76 L 77.42 76.77 L 91.77 62.42 L 79.76 46.43 L 98.90 35.38 L 106.75 53.77 L 126.35 48.52 Z';

export const MakmoLogo: React.FC<MakmoLogoProps> = ({
  className = 'h-8 sm:h-9 w-auto',
  theme = 'auto',
  showSubtitle = true,
  compact = false,
  preferOfficialImage = true,
}) => {
  const [imageError, setImageError] = useState(false);

  // Logo marca oficial padrão enviada pelo usuário (/assets/makmo_logo_oficial.jpg)
  if (preferOfficialImage && !imageError) {
    return (
      <div className="inline-flex items-center justify-center shrink-0">
        <img
          src="/assets/makmo_logo_oficial.jpg"
          alt="Sistema PCM NEXUS - Logo Oficial"
          className={`${className} object-contain rounded-md shadow-2xs select-none`}
          onError={() => setImageError(true)}
          loading="eager"
        />
      </div>
    );
  }

  // Se modo compacto (apenas o ícone de engrenagem com seta ascendente de tendência)
  if (compact) {
    return (
      <svg
        viewBox="35 20 200 200"
        className={className}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="PCM NEXUS Icon"
      >
        <rect width="270" height="240" rx="24" fill="#133863" />
        <path d={GEAR_PATH} fill="#20bdae" />
        <circle cx="135" cy="120" r="48" fill="#133863" />
        <polyline
          points="98,138 118,114 135,131 162,94"
          fill="none"
          stroke="#ffffff"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polygon points="170,84 148,88 162,102" fill="#ffffff" />
      </svg>
    );
  }

  // Versão vetorial completa com fundo ou adaptada
  const isTransparent = theme === 'brand';
  const bgColor = isTransparent ? 'transparent' : '#133863';

  return (
    <svg
      viewBox="0 0 800 240"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Sistema PCM NEXUS Logo"
    >
      {/* Background card */}
      <rect width="800" height="240" rx="12" fill={bgColor} />

      {/* Gear Cogwheel */}
      <path d={GEAR_PATH} fill="#20bdae" />
      <circle cx="135" cy="120" r="48" fill={bgColor === 'transparent' ? '#133863' : bgColor} />

      {/* Trend Arrow */}
      <polyline
        points="98,138 118,114 135,131 162,94"
        fill="none"
        stroke="#ffffff"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon points="170,84 148,88 162,102" fill="#ffffff" />

      {/* Typography */}
      {showSubtitle && (
        <text
          x="265"
          y="84"
          fill="#ffffff"
          style={{
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            fontSize: '34px',
            fontWeight: 400,
            letterSpacing: '0.22em',
          }}
        >
          Sistema
        </text>
      )}

      <text
        x="265"
        y="166"
        style={{
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          fontSize: '82px',
          fontWeight: 800,
          letterSpacing: '0.02em',
        }}
      >
        <tspan fill="#ffffff">PCM </tspan>
        <tspan fill="#20bdae">NEXUS</tspan>
      </text>
    </svg>
  );
};
