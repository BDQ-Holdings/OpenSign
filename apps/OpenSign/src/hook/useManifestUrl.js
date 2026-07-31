import { useEffect, useMemo } from "react";

export function useManifestUrl(appName, logo, shortName = appName) {
  const url = useMemo(() => {
    const start_url = window.location.origin || ".";
    const absoluteUrl = (path) => new URL(path, window.location.origin).href;
    const manifest = {
      short_name: shortName,
      name: appName,
      start_url: start_url,
      display: "standalone",
      theme_color: "#222222",
      background_color: "#ffffff",
      ...(logo && {
        icons: [
          { src: absoluteUrl(logo), sizes: "any", purpose: "any" },
          {
            src: absoluteUrl("/brand/bdq-emblem-192.png"),
            type: "image/png",
            sizes: "192x192"
          },
          {
            src: absoluteUrl("/brand/bdq-emblem-512.png"),
            type: "image/png",
            sizes: "512x512"
          }
        ]
      })
    };
    const blob = new Blob([JSON.stringify(manifest)], {
      type: "application/json"
    });
    return URL.createObjectURL(blob);
  }, [appName, logo, shortName]);

  useEffect(() => {
    // cleanup when unmounting or when url changes
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [url]);

  return url;
}
