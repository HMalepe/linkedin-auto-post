import type { ReactNode } from "react";

const PATHS: Record<string, ReactNode> = {
  queue: <path d="M8 6.5h12M8 12h12M8 17.5h12M4 6.5h.01M4 12h.01M4 17.5h.01" />,
  published: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.8 2.8L16 9.8" />
    </>
  ),
  activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  settings: (
    <>
      <path d="M4 7h8M18 7h2M4 17h2M12 17h8" />
      <circle cx="15" cy="7" r="2.2" />
      <circle cx="9" cy="17" r="2.2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  circle: <circle cx="12" cy="12" r="8" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  external: <path d="M8 16 16 8M9 8h7v7" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  image: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2.5" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m20 16-4.5-4.5L7 19" />
    </>
  ),
  sparkle: <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.7 1.8L21.5 18.5l-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z" />,
  trash: <path d="M5 7h14M10 11v6M14 11v6M6.5 7l1 12h9l1-12M9.5 7V4.5h5V7" />,
  logout: <path d="M10 5H5.5v14H10M14 8l4 4-4 4M18 12H9" />,
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6.5A1.5 1.5 0 0 1 6.5 5H15" />
    </>
  ),
  undo: <path d="M9 14 4 9l5-5M4 9h9a6 6 0 0 1 0 12h-3" />,
  send: <path d="M21 4 10 14.5M21 4l-6.5 17-4-6.5L4 10.5z" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  eyeOff: <path d="M3 3l18 18M10.6 5.7A9 9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.8M6.6 7.6A15.600 15.600 0 0 0 2.500 12S6 18.500 12 18.500c1.500 0 2.800-.4 4-.9M9.900 9.900a3 3 0 0 0 4.200 4.200" />,
  alert: <path d="M12 4 21.500 20h-19zM12 10v4.500M12 17.200h.01" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  refresh: <path d="M20 5v5h-5M4 19v-5h5M18.500 10A7 7 0 0 0 6 7.500L4 10M5.500 14A7 7 0 0 0 18 16.500L20 14" />,
  link: <path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1" />,
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

// The app mark: three lines of text and a dot for "scheduled".
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="15" fill="#0e1c33" />
      <rect x="15" y="19" width="34" height="5.500" rx="2.750" fill="#eaf0fb" />
      <rect x="15" y="29.500" width="25" height="5.500" rx="2.750" fill="#eaf0fb" opacity=".72" />
      <rect x="15" y="40" width="13" height="5.500" rx="2.750" fill="#eaf0fb" opacity=".48" />
      <circle cx="46" cy="42.750" r="6" fill="#5b82ff" />
    </svg>
  );
}
