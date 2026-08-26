import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // DEMO BUILD — the branding the production app reads from the host's
  // environment is baked in here instead, so `git clone && npm install &&
  // npm run dev` works with no setup, and deploying needs no variables set.
  // Nothing here is a secret; the demo has no backend to hold one.
  env: {
    NEXT_PUBLIC_MANDAL_NAME: "श्री गणेश मित्र मंडळ",
    NEXT_PUBLIC_MANDAL_ADDRESS: "शिवाजी चौक, पुणे ४११ ०३०",
    NEXT_PUBLIC_MANDAL_PRESIDENT: "रमेश जोशी",
    NEXT_PUBLIC_MANDAL_VICE_PRESIDENT: "सविता कुलकर्णी",
    NEXT_PUBLIC_RECEIPT_WATERMARK: "/idol.jpg",
  },
  // Deliberately no `experimental.staleTimes`. Caching page segments to save
  // refetches on tab switches was tried and reverted: keeping them meant a
  // colleague's edit had to invalidate the other cached tabs, and the only tool
  // that does that also invalidates the shared layout — which Next otherwise
  // reuses across navigations for free. Every tab switch after any change
  // became a cold layout+page load, so the app felt slower than with no cache
  // at all. Uncached pages refetch on navigation but keep the layout, which is
  // both faster in practice and always fresh.
  // Dev-only: let phones/tablets on the LAN load /_next/* bundles and HMR.
  // Has no effect on production builds.
  allowedDevOrigins: [
    "192.168.1.7",
    "*.local",
    "*.trycloudflare.com",
    "*.loca.lt",
  ],
};

export default nextConfig;
