export function ShieldEyeLogo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shield-logo"
    >
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Outer shield */}
      <path
        d="M50 96C10 78 6 52 6 36V14L50 4L94 14V36C94 52 90 78 50 96Z"
        stroke="var(--accent)"
        strokeWidth="2.5"
        fill="var(--surface)"
        filter="url(#glow)"
      />
      {/* Inner shield outline */}
      <path
        d="M50 84C20 70 16 50 16 38V22L50 14L84 22V38C84 50 80 70 50 84Z"
        stroke="var(--accent)"
        strokeWidth="1"
        fill="none"
        opacity="0.3"
      />
      {/* Eye ellipse */}
      <ellipse
        cx="50"
        cy="50"
        rx="22"
        ry="14"
        stroke="var(--accent)"
        strokeWidth="2"
        fill="none"
      />
      {/* Iris */}
      <circle cx="50" cy="50" r="8" fill="var(--accent)" />
      {/* Highlight */}
      <circle cx="53" cy="47" r="2.5" fill="white" />
    </svg>
  );
}
