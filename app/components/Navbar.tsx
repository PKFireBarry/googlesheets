"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Linkedin, Menu, X, CheckCircle, FileText, File, Settings, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, createContext, useContext, useEffect } from 'react'

// Create a context for navbar collapsed state
export const NavbarContext = createContext({
  isCollapsed: false,
  setIsCollapsed: (value: boolean) => {},
  mobileMenuOpen: false,
  setMobileMenuOpen: (value: boolean) => {},
});

export const useNavbar = () => useContext(NavbarContext);

export default function Navbar() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { isCollapsed, setIsCollapsed } = useNavbar();

  // Close mobile menu when path changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <nav className={`fixed left-0 top-0 h-screen bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg transition-all duration-300 z-40 ${isCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'} ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="h-full flex flex-col">
          {/* Logo and app name */}
          <div className={`p-4 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
            {!isCollapsed && (
              <Link href="/" className="flex items-center space-x-2">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24" 
                  fill="currentColor" 
                  className="w-8 h-8"
                >
                  <path d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625z" />
                  <path d="M12.971 1.816A5.23 5.23 0 0114.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 013.434 1.279 9.768 9.768 0 00-6.963-6.963z" />
                </svg>
                <span className="text-xl font-bold tracking-tight">JobTracker</span>
              </Link>
            )}
            
            {isCollapsed && (
              <Link href="/" className="flex items-center justify-center">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24" 
                  fill="currentColor" 
                  className="w-8 h-8"
                >
                  <path d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625z" />
                  <path d="M12.971 1.816A5.23 5.23 0 0114.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 013.434 1.279 9.768 9.768 0 00-6.963-6.963z" />
                </svg>
              </Link>
            )}

            {/* Mobile close button */}
            {mobileMenuOpen && (
              <button 
                onClick={() => setMobileMenuOpen(false)}
                className="md:hidden text-white"
                aria-label="Close menu"
              >
                <X className="w-6 h-6" />
              </button>
            )}
          </div>
          
          {/* Toggle collapse button - only show on desktop */}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute top-4 -right-4 bg-indigo-700 text-white p-1 rounded-full shadow-md hover:bg-indigo-800 hidden md:block"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          
          {/* Navigation links */}
          <div className="flex-1 overflow-y-auto py-4">
            <div className="px-2 space-y-1">
              <NavLink href="/" active={pathname === '/'} isCollapsed={isCollapsed}>
                <Home className="w-5 h-5 mr-2" />
                Home
              </NavLink>
              
              <NavLink href="/applied-jobs" active={pathname === '/applied-jobs'} isCollapsed={isCollapsed}>
                <CheckCircle className="w-5 h-5 mr-2" />
                Applied Jobs
              </NavLink>
              
              <NavLink href="/linkedin-lookup" active={pathname === '/linkedin-lookup'} isCollapsed={isCollapsed}>
                <Linkedin className="w-5 h-5 mr-2" />
                LinkedIn Lookup
              </NavLink>
              
              <NavLink href="/cover-letter" active={pathname === '/cover-letter'} isCollapsed={isCollapsed}>
                <FileText className="w-5 h-5 mr-2" />
                Cover Letters
              </NavLink>

              <NavLink href="/resume-builder" active={pathname === '/resume-builder'} isCollapsed={isCollapsed}>
                <File className="w-5 h-5 mr-2" />
                Resume Builder
              </NavLink>

              <NavLink href="/settings" active={pathname === '/settings'} isCollapsed={isCollapsed}>
                <Settings className="w-5 h-5 mr-2" />
                Settings
              </NavLink>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Mobile menu overlay - darkens the background when mobile menu is open */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      
      {/* Mobile menu button */}
      <button 
        className="fixed md:hidden z-50 bottom-4 right-4 p-3 rounded-md bg-blue-600 text-white shadow-lg"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
      >
        {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>
    </>
  )
}

function NavLink({ 
  href, 
  active, 
  isCollapsed,
  children 
}: { 
  href: string; 
  active: boolean; 
  isCollapsed: boolean;
  children: React.ReactNode 
}) {
  return (
    <Link 
      href={href}
      className={`flex items-center px-3 py-2 rounded-md transition-all duration-200 ${
        active 
          ? 'bg-white/20 text-white font-medium' 
          : 'text-blue-100 hover:bg-white/10 hover:text-white'
      } ${isCollapsed ? 'justify-center' : ''}`}
      title={isCollapsed ? typeof children === 'string' ? children : '' : ''}
    >
      {isCollapsed ? (
        <>
          {/* Only show icon when collapsed */}
          {Array.isArray(children) ? children[0] : children}
        </>
      ) : (
        <>
          {/* Show everything when expanded */}
          {children}
        </>
      )}
    </Link>
  )
}
