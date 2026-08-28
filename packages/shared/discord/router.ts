/**
 * 🔀 Universal Discord Interaction Router & Component Handlers (v7.0)
 * Manages Slash Commands, Context Menus, Modals, Autocomplete, and Auto-Deferral.
 */

export enum InteractionType {
  PING = 1,
  APPLICATION_COMMAND = 2,
  MESSAGE_COMPONENT = 3,
  APPLICATION_COMMAND_AUTOCOMPLETE = 4,
  MODAL_SUBMIT = 5,
}

export enum InteractionResponseType {
  PONG = 1,
  CHANNEL_MESSAGE_WITH_SOURCE = 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE = 5,
  DEFERRED_UPDATE_MESSAGE = 6,
  UPDATE_MESSAGE = 7,
  APPLICATION_COMMAND_AUTOCOMPLETE_RESULT = 8,
  MODAL = 9,
}

export enum ApplicationCommandType {
  CHAT_INPUT = 1,
  USER = 2,
  MESSAGE = 3,
}

export interface CommandOptionChoice {
  name: string;
  value: string | number;
}

export function createAutocompleteResponse(choices: CommandOptionChoice[]) {
  return {
    type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
    data: {
      choices: choices.slice(0, 25)
    }
  };
}

export function createEphemeralError(message: string, trackingId?: string) {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      flags: 64, // EPHEMERAL
      embeds: [
        {
          title: '⚠️ Command Execution Error',
          description: message,
          color: 0xe11d48, // Rose-600
          footer: {
            text: trackingId ? `Ray ID: ${trackingId}` : 'GameProductions Fleet Security'
          }
        }
      ]
    }
  };
}

export function createModalResponse(
  customId: string, 
  title: string, 
  components: any[]
) {
  return {
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: customId,
      title,
      components
    }
  };
}
