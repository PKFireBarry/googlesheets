"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, BarChart2, Linkedin, Menu, X, CheckCircle, FileText, File, Settings, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(true)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  
  // Check if sidebar state is saved in localStorage on client-side
  useEffect(() => {
    const savedState = localStorage.getItem('sidebarOpen')
    if (savedState !== null) {
      setIsOpen(savedState === 'true')
    }
    
    // Set initial state based on screen size
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsOpen(false)
      }
    }
    
    // Call once on mount
    handleResize()
    
    // Add event listener
    window.addEventListener('resize', handleResize)
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  // Save sidebar state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('sidebarOpen', isOpen.toString())
  }, [isOpen])

  const toggleSidebar = () => {
    setIsOpen(!isOpen)
  }
  
  const toggleMobileMenu = () => {
    setIsMobileOpen(!isMobileOpen)
  }
  
  const navItems = [
    { href: '/', icon: <Home className="w-5 h-5" />, label: 'Home' },
    { href: '/applied-jobs', icon: <CheckCircle className="w-5 h-5" />, label: 'Applied Jobs' },
    { href: '/linkedin-lookup', icon: <Linkedin className="w-5 h-5" />, label: 'LinkedIn Lookup' },
    { href: '/cover-letter', icon: <FileText className="w-5 h-5" />, label: 'Cover Letters' },
    { href: '/resume-builder', icon: <File className="w-5 h-5" />, label: 'Resume Builder' },
    { href: '/settings', icon: <Settings className="w-5 h-5" />, label: 'Settings' },
  ]
  
  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={toggleMobileMenu}
        className="md:hidden fixed top-4 left-4 z-30 p-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-white"
        aria-label="Toggle mobile menu"
      >
        <Menu className="w-5 h-5" />
      </button>
      
      {/* Mobile menu overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside 
        className={`h-screen sticky top-0 bg-gradient-to-b from-blue-600 to-indigo-700 text-white shadow-lg z-20 transition-all duration-300 ${
          isOpen ? 'w-64' : 'w-16'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} flex flex-col`}
      >
        <div className="flex items-center p-4 justify-between">
          {isOpen && (
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
          
          <div className="flex items-center">
            {/* Mobile close button */}
            <button
              onClick={toggleMobileMenu}
              className="md:hidden p-1 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-white mr-2"
              aria-label="Close mobile menu"
            >
              <X className="w-5 h-5" />
            </button>
            
            {/* Desktop toggle button */}
            <button 
              onClick={toggleSidebar}
              className="hidden md:block p-1 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-white"
              aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {isOpen ? (
                <ChevronLeft className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
        
        <div className="flex flex-col space-y-1 mt-6 px-2 flex-grow">
          {navItems.map((item) => (
            <Link 
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileOpen(false)}
              className={`flex items-center ${isOpen ? 'px-4' : 'justify-center px-2'} py-3 rounded-md transition-all duration-200 ${
                pathname === item.href 
                  ? 'bg-white/20 text-white font-medium' 
                  : 'text-blue-100 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center">
                {item.icon}
                {isOpen && <span className="ml-3">{item.label}</span>}
              </div>
            </Link>
          ))}
        </div>
      </aside>
    </>
  )
} 