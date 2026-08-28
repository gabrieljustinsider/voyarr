/**
 * ✨ Discord Dynamic Rich Presence Specification (v7.0)
 * Standardized activity structures and dynamic presence controllers.
 */

export enum ActivityType {
  Game = 0,         // Playing {name}
  Streaming = 1,    // Streaming {details}
  Listening = 2,    // Listening to {name}
  Watching = 3,     // Watching {name}
  Custom = 4,       // {state}
  Competing = 5,    // Competing in {name}
}

export type StatusType = 'online' | 'dnd' | 'idle' | 'invisible' | 'offline';

export interface ActivityPayload {
  name: string;
  type: ActivityType;
  url?: string;
  state?: string;
  details?: string;
  timestamps?: {
    start?: number;
    end?: number;
  };
  assets?: {
    large_image?: string;
    large_text?: string;
    small_image?: string;
    small_text?: string;
  };
  buttons?: Array<{ label: string; url: string }>;
}

export interface PresencePayload {
  since?: number | null;
  activities: ActivityPayload[];
  status: StatusType;
  afk: boolean;
}

export function createFleetPresence(
  appName: string, 
  activity: string, 
  type: ActivityType = ActivityType.Playing, 
  status: StatusType = 'online'
): PresencePayload {
  return {
    since: Date.now(),
    status,
    afk: false,
    activities: [
      {
        name: appName,
        type,
        state: activity,
        details: 'GameProductions Fleet',
        timestamps: { start: Date.now() },
        assets: {
          large_image: 'fleet_logo',
          large_text: 'GameProductions Cloud Platform'
        },
        buttons: [
          { label: 'Visit Hub', url: 'https://foundation.gpnet.dev' }
        ]
      }
    ]
  };
}
