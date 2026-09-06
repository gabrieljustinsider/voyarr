/**
 * Plain User Translation & Formatting Utilities for Cron Schedules
 * Converts standard cron expressions and presets into plain, intuitive human language.
 */

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Formats hour and minute into standard 12-hour AM/PM string.
 */
export function formatTime12(hour, minute) {
  const h = parseInt(hour, 10);
  const m = parseInt(minute, 10);
  if (isNaN(h) || isNaN(m)) return `${hour}:${minute}`;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 || 12;
  const displayMin = m < 10 ? `0${m}` : `${m}`;
  return `${displayHour}:${displayMin} ${period}`;
}

/**
 * Translates a standard 5-part cron expression (or common aliases) into a plain English sentence.
 * Handles common presets like 'manual', 'daily', 'weekly'.
 */
export function describeCron(cron) {
  if (!cron || typeof cron !== 'string') return 'No schedule configured';
  const trimmed = cron.trim().toLowerCase();

  // Handle common preset aliases
  if (trimmed === 'manual' || trimmed === 'none') return 'Manual trigger only';
  if (trimmed === 'daily') return 'Daily at 2:00 AM';
  if (trimmed === 'weekly') return 'Every Sunday at 2:00 AM';
  if (trimmed === 'hourly') return 'Hourly at the start of the hour';

  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) {
    return `Custom Schedule (${cron})`;
  }

  const [min, hour, dom, mon, dow] = parts;

  // Every N minutes
  if (min.startsWith('*/') && hour === '*' && dom === '*' && mon === '*' && dow === '*') {
    const interval = min.replace('*/', '');
    return interval === '1' ? 'Every minute' : `Every ${interval} minutes`;
  }

  // Every N hours at minute M
  if (hour.startsWith('*/') && dom === '*' && mon === '*' && dow === '*') {
    const interval = hour.replace('*/', '');
    const minDisplay = min === '0' ? 'top of the hour' : `${min} past the hour`;
    return `Every ${interval} hours at the ${minDisplay}`;
  }

  // Hourly at specific minute
  if (min !== '*' && hour === '*' && dom === '*' && mon === '*' && dow === '*') {
    if (min === '0') return 'Every hour, on the hour';
    return `Hourly at ${min} minutes past the hour`;
  }

  // Daily at specific time (e.g. 0 3 * * *)
  if (!min.includes('*') && !hour.includes('*') && dom === '*' && mon === '*' && dow === '*') {
    return `Daily at ${formatTime12(hour, min)}`;
  }

  // Specific days of week at specific time (e.g. 0 3 * * 0)
  if (!min.includes('*') && !hour.includes('*') && dom === '*' && mon === '*' && dow !== '*') {
    const timeStr = formatTime12(hour, min);

    // Weekday range (1-5)
    if (dow === '1-5') {
      return `Every weekday (Mon–Fri) at ${timeStr}`;
    }
    // Weekend (0,6 or 6,0)
    if (dow === '0,6' || dow === '6,0' || dow === '0-6') {
      if (dow === '0-6') return `Every day at ${timeStr}`;
      return `Every weekend (Sat & Sun) at ${timeStr}`;
    }

    // List of days (e.g. 0,2,4)
    if (dow.includes(',')) {
      const days = dow.split(',').map(d => DAY_NAMES[parseInt(d, 10)] || d).join(', ');
      return `Every ${days} at ${timeStr}`;
    }

    // Single day
    const dayNum = parseInt(dow, 10);
    if (!isNaN(dayNum) && DAY_NAMES[dayNum]) {
      return `Every ${DAY_NAMES[dayNum]} at ${timeStr}`;
    }

    return `Weekly on day ${dow} at ${timeStr}`;
  }

  // Specific day of month (e.g. 0 0 1 * *)
  if (!min.includes('*') && !hour.includes('*') && dom !== '*' && mon === '*' && dow === '*') {
    const timeStr = formatTime12(hour, min);
    return `Monthly on the ${dom}${getOrdinalSuffix(parseInt(dom, 10))} at ${timeStr}`;
  }

  // Specific day and month (e.g. 0 0 1 1 *)
  if (!min.includes('*') && !hour.includes('*') && dom !== '*' && mon !== '*' && dow === '*') {
    const timeStr = formatTime12(hour, min);
    const mNum = parseInt(mon, 10) - 1;
    const monthName = MONTH_NAMES[mNum] || `Month ${mon}`;
    return `Annually on ${monthName} ${dom} at ${timeStr}`;
  }

  // General fallback
  return `Runs at ${min} ${hour} on ${dom}/${mon} (cadence: ${dow})`;
}

function getOrdinalSuffix(n) {
  if (isNaN(n)) return '';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/**
 * Returns the formatted schedule string according to the active display mode.
 * - 'human_only': Returns only the plain English translation.
 * - 'hybrid': Returns plain English followed by the cron expression in brackets.
 */
export function formatScheduleDisplay(cron, mode = 'hybrid') {
  const plain = describeCron(cron);
  if (!cron) return plain;
  if (mode === 'human_only') {
    return plain;
  }
  return `${plain} (${cron})`;
}
