"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, BarChart2, Linkedin, Menu, X, CheckCircle } from 'lucide-react'
import { useState } from 'react'

export default function Navbar() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  return (
    <nav className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg w-full">
      <div className="container mx-auto px-4 py-3 no-overflow">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
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
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex space-x-1">
            <NavLink href="/" active={pathname === '/'}>
              <Home className="w-4 h-4 mr-2" />
              Home
            </NavLink>
            
            <NavLink href="/applied-jobs" active={pathname === '/applied-jobs'}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Applied Jobs
            </NavLink>
            
            <NavLink href="/analytics" active={pathname === '/analytics'}>
              <BarChart2 className="w-4 h-4 mr-2" />
              Analytics
            </NavLink>
            
            <NavLink href="/linkedin-lookup" active={pathname === '/linkedin-lookup'}>
              <Linkedin className="w-4 h-4 mr-2" />
              LinkedIn Lookup
            </NavLink>
          </div>
          
          {/* Mobile menu button */}
          <div className="md:hidden">
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-white"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
        
        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden pt-2 pb-3 space-y-1 mobile-container">
            <MobileNavLink href="/" active={pathname === '/'}>
              <Home className="w-4 h-4 mr-2" />
              Home
            </MobileNavLink>
            
            <MobileNavLink href="/applied-jobs" active={pathname === '/applied-jobs'}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Applied Jobs
            </MobileNavLink>
            
            <MobileNavLink href="/analytics" active={pathname === '/analytics'}>
              <BarChart2 className="w-4 h-4 mr-2" />
              Analytics
            </MobileNavLink>
            
            <MobileNavLink href="/linkedin-lookup" active={pathname === '/linkedin-lookup'}>
              <Linkedin className="w-4 h-4 mr-2" />
              LinkedIn Lookup
            </MobileNavLink>
          </div>
        )}
      </div>
    </nav>
  )
}

function NavLink({ 
  href, 
  active, 
  children 
}: { 
  href: string; 
  active: boolean; 
  children: React.ReactNode 
}) {
  return (
    <Link 
      href={href}
      className={`flex items-center px-4 py-2 rounded-md transition-all duration-200 ${
        active 
          ? 'bg-white/20 text-white font-medium' 
          : 'text-blue-100 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </Link>
  )
}

function MobileNavLink({ 
  href, 
  active, 
  children 
}: { 
  href: string; 
  active: boolean; 
  children: React.ReactNode 
}) {
  return (
    <Link 
      href={href}
      className={`flex items-center px-3 py-2 rounded-md ${
        active 
          ? 'bg-white/20 text-white' 
          : 'text-blue-100 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </Link>
  )
}
