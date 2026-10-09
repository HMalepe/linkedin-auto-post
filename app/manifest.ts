import type { MetadataRoute } from "next";

// Lets you "Add to Home Screen" on a phone so the dashboard opens like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Autoposter",
    short_name: "Autoposter",
    description: "Claude drafts, you approve, it posts on schedule.",
    start_url: "/",
    display: "standalone",
    background_color: "#0e1c33",
    theme_color: "#0e1c33",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
