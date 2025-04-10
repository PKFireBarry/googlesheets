"use client"

export default function Footer() {
  return (
    <footer className="bg-gradient-to-r from-gray-900 to-gray-800 text-gray-300 py-8 mt-auto">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                fill="currentColor" 
                className="w-6 h-6 text-blue-400"
              >
                <path d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625z" />
                <path d="M12.971 1.816A5.23 5.23 0 0114.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 013.434 1.279 9.768 9.768 0 00-6.963-6.963z" />
              </svg>
              <h3 className="text-lg font-semibold text-white">JobTracker</h3>
            </div>
            <p className="text-sm">Track and manage your job applications efficiently with AI-powered tools</p>
          </div>
          
          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Features</h4>
            <ul className="space-y-2">
              <li><a href="/" className="text-sm hover:text-blue-400 transition-colors">Jobs</a></li>
              <li><a href="/linkedin-lookup" className="text-sm hover:text-blue-400 transition-colors">Linkedin Lookup</a></li>
              <li><a href="/cover-letter" className="text-sm hover:text-blue-400 transition-colors">Cover Letter</a></li>
              <li><a href="/resume-builder" className="text-sm hover:text-blue-400 transition-colors">Resume Builder</a></li>
              <li><a href="/settings" className="text-sm hover:text-blue-400 transition-colors">Settings</a></li>
            </ul>
          </div>
          
          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Legal</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-sm hover:text-blue-400 transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="text-sm hover:text-blue-400 transition-colors">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-700 mt-8 pt-6 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm">&copy; {new Date().getFullYear()} JobTracker. All rights reserved.</p>
          <p className="text-xs mt-2 md:mt-0">Powered by Google Gemini</p>
        </div>
      </div>
    </footer>
  )
}
