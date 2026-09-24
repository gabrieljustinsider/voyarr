/** @jsxImportSource react */
import React from 'react';

export interface FooterProps {
  appName?: string;
  version?: string;
  isGloson?: boolean;
}

/**
 * Universal Fleet Footer
 * Standardized branding and legal disclosure for all GameProductions apps.
 */
export const Footer: React.FC<FooterProps> = ({ 
  appName = "Foundation", 
  version = "Stable", 
  isGloson = false 
}) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto pt-16 pb-12 px-6 border-t border-slate-900 bg-slate-950/50 backdrop-blur-md">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Top Row: Context & Navigation */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-sm font-bold tracking-tight">
          <div className="flex items-center space-x-4">
            <span className="text-white uppercase tracking-widest text-[10px]">
              {appName}
            </span>
            <span className="px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-cyan-400 text-[10px]">
              {version}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-slate-500 uppercase tracking-widest text-[10px]">
            <a href="/legal/terms" className="hover:text-cyan-400 transition-colors">Terms</a>
            <a href="/legal/privacy" className="hover:text-cyan-400 transition-colors">Privacy</a>
            <a href="/legal/security" className="hover:text-cyan-400 transition-colors">Security</a>
            <a href="/legal/safety" className="hover:text-cyan-400 transition-colors">Safety</a>
            <a href="/legal/cookies" className="hover:text-cyan-400 transition-colors">Cookies</a>
          </div>
        </div>

        {/* Bottom Row: Ownership */}
        <div className="pt-8 border-t border-slate-900/50 flex justify-center">
          <p className="text-slate-600 text-[10px] font-bold tracking-[0.2em] uppercase">
            {currentYear} GameProductions™{isGloson ? ' | Gloson Production™' : ''}. All rights reserved.
          </p>
        </div>

      </div>
    </footer>
  );
};
