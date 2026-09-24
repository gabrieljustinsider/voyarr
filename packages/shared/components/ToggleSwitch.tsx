import React from 'react';

export interface ToggleSwitchProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  color?: 'primary' | 'amber' | 'violet' | 'blue' | 'emerald';
  size?: 'sm' | 'md';
  label?: string;
  description?: string;
  className?: string;
}

const COLOR_CLASSES: Record<NonNullable<ToggleSwitchProps['color']>, string> = {
  primary: 'peer-checked:bg-primary',
  amber: 'peer-checked:bg-amber-500',
  violet: 'peer-checked:bg-violet-500',
  blue: 'peer-checked:bg-blue-600',
  emerald: 'peer-checked:bg-emerald-600',
};

const SIZE_CONFIGS = {
  sm: {
    track: 'w-9 h-5',
    knob: 'after:top-[2px] after:left-[2px] after:h-4 after:w-4',
  },
  md: {
    track: 'w-10 h-5',
    knob: 'after:top-[2px] after:left-[2px] after:h-4 after:w-4',
  },
};

/**
 * Standardized accessible toggle switch component adhering to Law 131.
 * Guarantees that the toggle track pill element always includes `relative`
 * so the pseudo-element indicator dot stays strictly aligned inside the pill.
 */
export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  id,
  checked,
  onChange,
  disabled = false,
  color = 'primary',
  size = 'md',
  label,
  description,
  className = '',
}) => {
  const sizeConfig = SIZE_CONFIGS[size];
  const colorClass = COLOR_CLASSES[color] || COLOR_CLASSES.primary;

  const toggleControl = (
    <label className={`relative inline-flex items-center ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <div
        className={`relative ${sizeConfig.track} bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute ${sizeConfig.knob} after:bg-white/40 after:border-white/10 after:border after:rounded-full after:transition-all ${colorClass}`}
      />
    </label>
  );

  if (!label && !description) {
    return <div className={`inline-flex items-center ${className}`}>{toggleControl}</div>;
  }

  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      {(label || description) && (
        <div className="space-y-0.5">
          {label && <div className="text-xs font-bold text-white">{label}</div>}
          {description && <div className="text-[10px] text-white/40">{description}</div>}
        </div>
      )}
      {toggleControl}
    </div>
  );
};

export default ToggleSwitch;
