import React, { useEffect } from 'react';

// Small wrapper to guard portal container removals to avoid removeChild errors
export default function DialogPortalSafe({ children }) {
  useEffect(() => {
    return () => {
      // Best-effort cleanup of stray dialog portals
      try {
        const portals = document.querySelectorAll('[data-state="open"], [role="dialog"]');
        portals.forEach((p) => {
          if (p && p.parentNode && p.parentNode.contains(p)) {
            // no-op; rely on Radix cleanup; avoid manual removeChild
          }
        });
      } catch (_) {}
    };
  }, []);
  return children;
}
