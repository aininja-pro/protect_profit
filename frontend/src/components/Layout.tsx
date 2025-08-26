import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  
  return (
    <div className="min-h-screen bg-light">
      {/* Header */}
      <header className="bg-dark shadow-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-6">
              <img 
                src="/team-builders-logo.png" 
                alt="TeamBuilders" 
                className="h-10 w-auto"
              />
              <div className="flex items-center">
                <h1 className="text-lg font-semibold text-primary">
                  Operation Protect Profit
                </h1>
              </div>
            </div>
            
            {/* Navigation */}
            <nav className="hidden md:flex space-x-8">
              <Link 
                to="/budget" 
                className={cn(
                  "px-3 py-2 text-sm font-medium",
                  location.pathname === '/budget' 
                    ? "text-primary border-b-2 border-primary" 
                    : "text-white hover:text-primary"
                )}
              >
                Budget Upload
              </Link>
              <Link 
                to="/quotes" 
                className={cn(
                  "px-3 py-2 text-sm font-medium",
                  location.pathname === '/quotes' 
                    ? "text-primary border-b-2 border-primary" 
                    : "text-white hover:text-primary"
                )}
              >
                Quote Upload
              </Link>
              <a href="#" className="text-white hover:text-primary px-3 py-2 text-sm font-medium">
                Dashboard
              </a>
            </nav>
            
            {/* User menu */}
            <div className="flex items-center">
              <button className="bg-primary text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-sm text-gray-500 text-center">
            © 2025 TeamBuilders Construction. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}