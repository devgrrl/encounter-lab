const strokeProps = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function ResetIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...strokeProps}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 3v6h6" />
    </svg>
  );
}

export function DamageIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
    </svg>
  );
}

export function HealIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...strokeProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

export function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...strokeProps}>
      <path d="M12 3.5 5 6v6c0 4.5 3 7.5 7 8.5 4-1 7-4 7-8.5V6l-7-2.5Z" />
      <path d="M9 12.2l2 2 4-4.4" />
    </svg>
  );
}

export function ClearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...strokeProps}>
      <path d="M5 5l14 14M19 5 5 19" />
    </svg>
  );
}
