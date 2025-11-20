import React, { useEffect, useRef, useState } from "react";
import "./styles/navbar/navbar.css";

/**
 * TopNavbar
 * - Fixed at top, semi-transparent with subtle backdrop blur
 * - Hides when scrolling down, shows when scrolling up
 * - Only base bar UI for now (no nav items)
 */
export default function TopNavbar() {
  const [hidden, setHidden] = useState(false);
  const lastYRef = useRef(0);
  const tickingRef = useRef(false);

  useEffect(() => {
    // Initialize last scroll position at mount
    lastYRef.current = window.scrollY || 0;

    const onScroll = () => {
      const currentY = window.scrollY || 0;
      if (!tickingRef.current) {
        window.requestAnimationFrame(() => {
          const lastY = lastYRef.current;
          const delta = currentY - lastY;

          // Show when near top
          if (currentY < 10) {
            setHidden(false);
          } else {
            // Hide on scroll down (positive delta), show on scroll up (negative delta)
            if (delta > 2) {
              setHidden(true);
            } else if (delta < -2) {
              setHidden(false);
            }
          }

          lastYRef.current = currentY;
          tickingRef.current = false;
        });
        tickingRef.current = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={`top-navbar ${hidden ? "top-navbar--hidden" : ""}`} role="navigation" aria-label="Top navigation bar" />
  );
}
