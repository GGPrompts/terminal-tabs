// Chrome Extension Message Types

export type MessageType =
  | 'OPEN_SESSION'
  | 'SPAWN_TERMINAL'
  | 'CLOSE_SESSION'
  | 'ADD_CONTEXT_MENU'
  | 'SHOW_ERROR_SUGGESTION'
  | 'UPDATE_BADGE'
  | 'WS_MESSAGE'
  | 'WS_CONNECTED'
  | 'WS_DISCONNECTED';

export interface BaseMessage {
  type: MessageType;
}

export interface OpenSessionMessage extends BaseMessage {
  type: 'OPEN_SESSION';
  sessionName: string;
}

export interface SpawnTerminalMessage extends BaseMessage {
  type: 'SPAWN_TERMINAL';
  command?: string;
  cwd?: string;
  spawnOption?: string;
}

export interface CloseSessionMessage extends BaseMessage {
  type: 'CLOSE_SESSION';
  sessionName: string;
}

export interface AddContextMenuMessage extends BaseMessage {
  type: 'ADD_CONTEXT_MENU';
  items: ContextMenuItem[];
}

export interface ContextMenuItem {
  id: string;
  title: string;
  action: () => void;
}

export interface ShowErrorSuggestionMessage extends BaseMessage {
  type: 'SHOW_ERROR_SUGGESTION';
  error: string;
  suggestion: string;
}

export interface UpdateBadgeMessage extends BaseMessage {
  type: 'UPDATE_BADGE';
  count: number;
}

export interface WSMessage extends BaseMessage {
  type: 'WS_MESSAGE';
  data: any;
}

export interface WSConnectedMessage extends BaseMessage {
  type: 'WS_CONNECTED';
}

export interface WSDisconnectedMessage extends BaseMessage {
  type: 'WS_DISCONNECTED';
}

export type ExtensionMessage =
  | OpenSessionMessage
  | SpawnTerminalMessage
  | CloseSessionMessage
  | AddContextMenuMessage
  | ShowErrorSuggestionMessage
  | UpdateBadgeMessage
  | WSMessage
  | WSConnectedMessage
  | WSDisconnectedMessage;

// Helper function to send messages
export function sendMessage(message: ExtensionMessage): Promise<any> {
  return chrome.runtime.sendMessage(message);
}

// Helper function to listen to messages
export function onMessage(
  callback: (message: ExtensionMessage, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => void
) {
  chrome.runtime.onMessage.addListener(callback);
}
