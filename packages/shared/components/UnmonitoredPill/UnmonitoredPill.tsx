/** @jsxImportSource react */
import React, { useState, useRef, useEffect } from 'react';
import { Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface UnmonitoredPillProps {
  projectName?: string;
  fieldName?: string;
  migrationTimestamp?: string;
  className?: string;
}

/**
 * 🛡️ Modular Unmonitored Baseline Indicator Pill
 * Communicates to users why a specific telemetry or profile field does not have historical data.
 * Responsive design with onHover tooltip (desktop) and onClick modal popover (mobile/foldables/tablets).
 */
export const UnmonitoredPill: React.FC<UnmonitoredPillProps> = ({
  projectName = 'Foundation Fleet',
  fieldName = 'This parameter',
  migrationTimestamp = 'August 19, 2026, 12:00 PM EST',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutside);
      document.addEventListener('touchstart', handleOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [isOpen]);

  const showPopup = isOpen || isHovered;

  return (
    <div 
      ref={containerRef}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(prev => !prev);
        }}
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 hover:border-blue-500/40 text-slate-400 hover:text-slate-200 transition-all text-[10px] font-bold tracking-wide cursor-pointer select-none group focus:outline-none"
        aria-label={`Unmonitored field notice for ${fieldName}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-slate-500 group-hover:bg-blue-400 animate-pulse" />
        <span>Unmonitored</span>
        <Info className="w-3 h-3 text-slate-500 group-hover:text-blue-400 transition-colors" />
      </button>

      <AnimatePresence>
        {showPopup && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="fixed md:absolute z-[9999] bottom-4 left-4 right-4 md:bottom-full md:left-1/2 md:-translate-x-1/2 md:right-auto md:mb-2 md:w-80 p-4 rounded-2xl bg-slate-900/95 border border-white/15 shadow-2xl backdrop-blur-xl text-left pointer-events-auto"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <Info className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-black text-white tracking-tight">
                  Telemetry Baseline Notice
                </h4>
              </div>
              <button
                type="button"
                onClick={() => { setIsOpen(false); setIsHovered(false); }}
                className="md:hidden p-1 text-slate-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              <strong className="text-white font-bold">{fieldName}</strong> in <strong className="text-blue-400 font-bold">{projectName}</strong> was recorded prior to the Foundation Fleet baseline migration on <span className="text-slate-200 font-semibold">{migrationTimestamp}</span>.
            </p>

            <p className="text-[10px] text-slate-400 mt-2 pt-2 border-t border-white/5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Actively tracked and monitored moving forward.</span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
