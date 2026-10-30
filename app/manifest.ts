import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Secure Paddocks UK",
    short_name: "Paddocks",
    description: "Book Soar Valley K9 Secluded Retreat, a private secure dog field.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#EEF6FA",
    theme_color: "#2F5D7B",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
