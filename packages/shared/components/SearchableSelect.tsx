/**
 * @name SearchableSelect
 * @description Core standardized, accessible, and motion-aware dropdown component supporting search filtering, dynamic inline entity creation, unselect/clear triggers, keyboard navigation, and scraped-source immutability.
 * @category Forms
 * @subcategory Form Controls
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface SearchableOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  metadata?: any;
}

export interface SearchableSelectProps {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  icon?: React.ReactNode;
  onCreate?: (search: string) => Promise<string | void> | string | void;
  searchable?: boolean;
  isScrapedSource?: boolean;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  clearable?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select option...',
  className = '',
  icon: LeadingIcon,
  onCreate,
  searchable = true,
  isScrapedSource = false,
  size = 'md',
  disabled = false,
  clearable = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sortedOptions = useMemo(() => {
    return [...options].sort((a, b) => a.label.localeCompare(b.label));
  }, [options]);

  const selectedOption = useMemo(
    () => sortedOptions.find(o => o.value === value),
    [sortedOptions, value]
  );

  const showCreateOption = useMemo(() => {
    if (isScrapedSource || !onCreate || !search.trim()) return false;
    return !sortedOptions.some(opt => opt.label.toLowerCase() === search.trim().toLowerCase());
  }, [sortedOptions, search, onCreate, isScrapedSource]);

  const filteredOptions = useMemo(() => {
    if (!search) return sortedOptions;
    return sortedOptions.filter(opt =>
      opt.label.toLowerCase().includes(search.toLowerCase()) ||
      (opt.metadata?.email && opt.metadata.email.toLowerCase().includes(search.toLowerCase()))
    );
  }, [sortedOptions, search]);

  useEffect(() => { setActiveIndex(0); }, [search]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') setIsOpen(true);
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % filteredOptions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => (prev - 1 + filteredOptions.length) % filteredOptions.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredOptions[activeIndex]) {
          const opt = filteredOptions[activeIndex];
          if (opt.value === value && clearable) {
            onChange('');
          } else {
            onChange(opt.value);
          }
          setIsOpen(false);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  const sizeClasses = size === 'sm' 
    ? 'px-2.5 py-1.5 text-xs rounded-lg' 
    : size === 'lg' 
    ? 'px-4 py-3 text-sm rounded-2xl' 
    : 'px-3 py-2 text-xs rounded-xl';

  const dropdownContent = (
    <>
      {/* Scraped Read-Only Header Badge */}
      {isScrapedSource && (
        <div className="px-3 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
            🔒 Scraped Source (Read-Only)
          </span>
          <span className="text-[9px] text-slate-400 font-mono">Immutable</span>
        </div>
      )}

      {/* Search Input */}
      {searchable && (
        <div className="p-2.5 border-b border-white/5 bg-white/2">
          <div className="relative flex items-center">
            <Search size={13} className="absolute left-3 text-slate-500" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full bg-black/40 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:border-blue-500/30 transition-all focus:outline-none"
              onClick={e => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* Options List */}
      <div className="max-h-[240px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10" role="listbox">
        {showCreateOption && (
          <div
            role="option"
            onClick={async e => {
              e.stopPropagation();
              const newId = await onCreate!(search.trim());
              if (newId) onChange(newId);
              setSearch('');
              setIsOpen(false);
            }}
            className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-all hover:bg-white/5 text-blue-400 font-bold"
          >
            <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <Plus size={12} className="text-blue-400" />
            </div>
            <span className="text-xs font-bold tracking-tight">Create "{search.trim()}"</span>
          </div>
        )}
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option, idx) => {
            const isActive = idx === activeIndex;
            const isSelected = option.value === value;
            return (
              <div
                key={option.value}
                role="option"
                aria-selected={isSelected}
                onClick={e => {
                  e.stopPropagation();
                  if (isSelected && clearable) {
                    onChange('');
                  } else {
                    onChange(option.value);
                  }
                  setIsOpen(false);
                }}
                onMouseEnter={() => setActiveIndex(idx)}
                className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-all ${
                  isActive ? 'bg-white/5' : ''
                } ${isSelected ? 'text-sky-400 bg-sky-500/5' : 'text-slate-300'}`}
              >
                {option.icon ? (
                  <div className="shrink-0">{option.icon}</div>
                ) : (
                  <div className="w-6 h-6 rounded-lg bg-black/40 flex items-center justify-center border border-white/5 text-[10px] font-black italic shrink-0 text-slate-400">
                    {option.label.charAt(0)}
                  </div>
                )}
                <div className="flex-1 flex flex-col overflow-hidden">
                  <span className="text-xs font-bold tracking-tight truncate">{option.label}</span>
                  {option.metadata?.subtext && (
                    <span className="text-[10px] text-slate-500 truncate">{option.metadata.subtext}</span>
                  )}
                </div>
                {isSelected && <Check size={13} className="text-sky-400 shrink-0" />}
              </div>
            );
          })
        ) : (
          <div className="p-6 text-center">
            <p className="text-[10px] text-slate-600 font-black uppercase tracking-[0.2em] italic">No Matches Found</p>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className={`relative ${className}`} ref={containerRef} onKeyDown={handleKeyDown}>
      {/* Trigger */}
      <div
        onClick={() => { 
          if (disabled) return;
          setIsOpen(!isOpen); 
          if (!isOpen && searchable) setTimeout(() => inputRef.current?.focus(), 50); 
        }}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`flex items-center gap-2 bg-slate-900/60 border rounded-xl cursor-pointer transition-all duration-200 group ${sizeClasses} ${
          disabled ? 'opacity-50 cursor-not-allowed bg-slate-950/40 border-white/5' :
          isOpen ? 'border-sky-500/40 ring-1 ring-sky-500/20' : 'border-white/10 hover:border-white/20'
        }`}
      >
        <div className="flex-1 flex items-center gap-2 overflow-hidden">
          {selectedOption?.icon || LeadingIcon || (searchable ? <Search size={12} className="text-slate-500 shrink-0" /> : null)}
          <span className={`text-xs font-medium truncate ${selectedOption ? 'text-white' : 'text-slate-500'}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {clearable && !!value && !disabled && (
            <button
              type="button"
              title="Clear selection"
              aria-label="Clear selection"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="p-0.5 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X size={size === 'sm' ? 10 : 12} />
            </button>
          )}
          <ChevronDown size={12} className={`text-slate-500 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute z-[3000] left-0 right-0 mt-1.5 bg-[#0d0d0d]/98 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden min-w-[200px]"
          >
            {dropdownContent}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
