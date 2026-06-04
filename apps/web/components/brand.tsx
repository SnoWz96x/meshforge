// Marca MeshForge — cristal low-poly "forge heat" (mesmo conceito do logo SVG).
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" fill="none" aria-hidden>
      <defs>
        <linearGradient id="mf-heat" x1="64" y1="8" x2="64" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFD37A" />
          <stop offset="0.45" stopColor="#FF6B35" />
          <stop offset="1" stopColor="#E8336D" />
        </linearGradient>
      </defs>
      <polygon points="64,16 26,44 64,50" fill="url(#mf-heat)" opacity="0.92" />
      <polygon points="64,16 64,50 102,44" fill="url(#mf-heat)" opacity="0.78" />
      <polygon points="26,44 64,50 64,84 38,86" fill="url(#mf-heat)" opacity="0.5" />
      <polygon points="64,50 102,44 90,86 64,84" fill="url(#mf-heat)" opacity="0.62" />
      <polygon points="38,86 64,84 64,112" fill="url(#mf-heat)" opacity="0.34" />
      <polygon points="64,84 90,86 64,112" fill="url(#mf-heat)" opacity="0.44" />
      <g stroke="#FFE7C4" strokeWidth="1.6" strokeLinejoin="round" opacity="0.85" fill="none">
        <polygon points="64,16 26,44 38,86 64,112 90,86 102,44" />
        <path d="M64,16 L64,50 M26,44 L64,50 L102,44 M64,50 L64,84 M38,86 L64,84 L90,86 M64,84 L64,112" />
      </g>
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="text-[15px] font-extrabold tracking-tight">
      <span className="text-content">Mesh</span>
      <span className="bg-accent-grad bg-clip-text text-transparent">Forge</span>
    </span>
  );
}
