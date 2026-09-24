import React from 'react';
import { SearchableSelect, SearchableOption } from './SearchableSelect';
import { Tag, Globe, ShieldCheck, Database } from 'lucide-react';

// ============================================================================
// TIER 1: Database-Linked Entity Lists (Searchable + Async Inline Create)
// ============================================================================

export interface DatabaseEntitySelectProps {
  apiEndpoint?: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  onOptionsChange?: (options: SearchableOption[]) => void;
  placeholder?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export const DatabaseEntitySelect: React.FC<DatabaseEntitySelectProps> = ({
  apiEndpoint = '/api/entities',
  value,
  onChange,
  options,
  onOptionsChange,
  placeholder = 'Select or create entity...',
  className = '',
  size = 'md',
  disabled = false,
}) => {
  const handleCreate = async (searchQuery: string): Promise<string | void> => {
    try {
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: searchQuery }),
      });

      if (!res.ok) throw new Error('Failed to create new entity');

      const created = (await res.json()) as { id: string; name: string };
      const newOption: SearchableOption = {
        value: created.id,
        label: created.name,
        metadata: { subtext: 'Custom Entity' },
      };

      if (onOptionsChange) {
        onOptionsChange([...options, newOption]);
      }

      return created.id;
    } catch (err) {
      console.error('Error creating entity from dropdown:', err);
    }
  };

  return (
    <SearchableSelect
      options={options}
      value={value}
      onChange={onChange}
      onCreate={handleCreate}
      searchable={true}
      isScrapedSource={false}
      placeholder={placeholder}
      className={className}
      icon={<Tag className="w-4 h-4 text-emerald-400" />}
      size={size}
      disabled={disabled}
    />
  );
};

// ============================================================================
// TIER 2: Static Pre-Configured Constants (Searchable Only)
// ============================================================================

export interface StaticOptionsSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  className?: string;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export const StaticOptionsSelect: React.FC<StaticOptionsSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  className = '',
  icon = <Globe className="w-4 h-4 text-sky-400" />,
  size = 'sm',
  disabled = false,
}) => {
  return (
    <SearchableSelect
      options={options}
      value={value}
      onChange={onChange}
      searchable={true}
      onCreate={undefined}
      isScrapedSource={false}
      placeholder={placeholder}
      className={className}
      icon={icon}
      size={size}
      disabled={disabled}
    />
  );
};

// ============================================================================
// TIER 3: Action, Policy & Function Selectors (No Search, No Create)
// ============================================================================

export interface ActionPolicySelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  className?: string;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export const ActionPolicySelect: React.FC<ActionPolicySelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select action or policy...',
  className = '',
  icon = <ShieldCheck className="w-4 h-4 text-violet-400" />,
  size = 'sm',
  disabled = false,
}) => {
  return (
    <SearchableSelect
      options={options}
      value={value}
      onChange={onChange}
      searchable={false}
      onCreate={undefined}
      isScrapedSource={false}
      placeholder={placeholder}
      className={className}
      icon={icon}
      size={size}
      disabled={disabled}
    />
  );
};

// ============================================================================
// TIER 4: Scraped & External Read-Only Sources (Immutable Lock)
// ============================================================================

export interface ScrapedSourceSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  className?: string;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export const ScrapedSourceSelect: React.FC<ScrapedSourceSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Search scraped external dataset...',
  className = '',
  icon = <Database className="w-4 h-4 text-amber-400" />,
  size = 'md',
  disabled = false,
}) => {
  return (
    <SearchableSelect
      options={options}
      value={value}
      onChange={onChange}
      searchable={true}
      onCreate={undefined}
      isScrapedSource={true}
      placeholder={placeholder}
      className={className}
      icon={icon}
      size={size}
      disabled={disabled}
    />
  );
};
