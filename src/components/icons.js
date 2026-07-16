// Shared line-art icon set. Each icon inherits colour from `currentColor` and
// takes a `className` so callers control size and tone from Tailwind.

function Icon({ size = 18, className, children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function UserIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" strokeLinecap="round" />
    </Icon>
  );
}

export function IdIcon(props) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <circle cx="8.5" cy="11" r="2" />
      <path d="M5.5 16a3.2 3.2 0 0 1 6 0M14 10h4M14 14h4" strokeLinecap="round" />
    </Icon>
  );
}

export function LockIcon(props) {
  return (
    <Icon {...props}>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </Icon>
  );
}

export function EyeIcon({ size = 17, ...props }) {
  return (
    <Icon size={size} {...props}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}

export function EyeOffIcon({ size = 17, ...props }) {
  return (
    <Icon size={size} {...props}>
      <path d="M3 3l18 18" strokeLinecap="round" />
      <path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6A17.6 17.6 0 0 0 2 12s3.5 7 10 7a10.9 10.9 0 0 0 4.5-.9" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </Icon>
  );
}

export function ArrowRightIcon({ size = 16, ...props }) {
  return (
    <Icon size={size} strokeWidth="2.4" {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  );
}

export function ShieldCheckIcon({ size = 18, ...props }) {
  return (
    <Icon size={size} {...props}>
      <path d="M12 3l7 4v5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V7l7-4z" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  );
}

export function KeyIcon({ size = 18, ...props }) {
  return (
    <Icon size={size} {...props}>
      <circle cx="8" cy="14" r="4" />
      <path d="M11 11l8-8M17 3l3 3M14 6l3 3" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  );
}

export function LayersIcon({ size = 18, ...props }) {
  return (
    <Icon size={size} {...props}>
      <path d="M12 3l9 5-9 5-9-5 9-5z" strokeLinejoin="round" />
      <path d="M3 13l9 5 9-5M3 17l9 5 9-5" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  );
}

export function TrailIcon({ size = 18, ...props }) {
  return (
    <Icon size={size} {...props}>
      <path d="M8 4h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <path d="M10 9h6M10 13h6M10 17h3" strokeLinecap="round" />
    </Icon>
  );
}

export function BellIcon({ size = 18, ...props }) {
  return (
    <Icon size={size} {...props}>
      <path d="M18 8a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.3 18a2 2 0 0 0 3.4 0" strokeLinecap="round" />
    </Icon>
  );
}

export function LogoutIcon({ size = 16, ...props }) {
  return (
    <Icon size={size} {...props}>
      <path d="M15 12H4M8 8l-4 4 4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 4h6v16h-6" />
    </Icon>
  );
}

export function PlusIcon({ size = 16, ...props }) {
  return (
    <Icon size={size} strokeWidth="2.4" {...props}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </Icon>
  );
}

export function EditIcon({ size = 15, ...props }) {
  return (
    <Icon size={size} {...props}>
      <path d="M4 20h4L20 8l-4-4L4 16v4z" strokeLinejoin="round" />
    </Icon>
  );
}

export function CloseIcon({ size = 18, ...props }) {
  return (
    <Icon size={size} {...props}>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </Icon>
  );
}

export function BoltIcon({ size = 14, className = "text-copper" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13l0-8z" />
    </svg>
  );
}
