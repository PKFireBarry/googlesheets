"use client";

import { ReactNode, useState, useEffect } from "react";
import { NavbarContext } from "./components/Navbar";

export function Providers({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Update layout classes when navbar state changes
  useEffect(() => {
    const mainContent = document.querySelector('.max-w-6xl');
    if (mainContent) {
      if (isCollapsed) {
        document.body.classList.add('navbar-collapsed');
        document.body.classList.remove('navbar-expanded');
      } else {
        document.body.classList.add('navbar-expanded');
        document.body.classList.remove('navbar-collapsed');
      }
    }
    
    // Handle overflow when mobile menu is open
    if (mobileMenuOpen) {
      document.body.classList.add('mobile-menu-open');
    } else {
      document.body.classList.remove('mobile-menu-open');
    }
  }, [isCollapsed, mobileMenuOpen]);

  return (
    <NavbarContext.Provider value={{ isCollapsed, setIsCollapsed, mobileMenuOpen, setMobileMenuOpen }}>
      {children}
    </NavbarContext.Provider>
  );
} 