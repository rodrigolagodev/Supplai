export type ConversationState =
  | 'idle'
  | 'typing'
  | 'recording'
  | 'sending_message'
  | 'ai_processing'
  | 'ai_streaming'
  | 'error';

export type ConversationEvent =
  | { type: 'USER_STARTED_TYPING' }
  | { type: 'USER_STOPPED_TYPING' }
  | { type: 'USER_STARTED_RECORDING' }
  | { type: 'USER_STOPPED_RECORDING' }
  | { type: 'MESSAGE_QUEUED' }
  | { type: 'AI_CALL_STARTED' }
  | { type: 'AI_RESPONSE_STREAMING' }
  | { type: 'AI_RESPONSE_COMPLETE' }
  | { type: 'ERROR_OCCURRED'; error: Error }
  | { type: 'ERROR_RECOVERED' };

type TransitionTable = Record<
  ConversationState,
  Partial<Record<ConversationEvent['type'], ConversationState>>
>;

export class ConversationStateMachine {
  private state: ConversationState = 'idle';
  private listeners: Array<(state: ConversationState) => void> = [];

  private transitions: TransitionTable = {
    idle: {
      USER_STARTED_TYPING: 'typing',
      USER_STARTED_RECORDING: 'recording',
      MESSAGE_QUEUED: 'sending_message',
      AI_CALL_STARTED: 'ai_processing',
    },
    typing: {
      USER_STOPPED_TYPING: 'idle',
      USER_STARTED_RECORDING: 'recording', // Cancel typing
      MESSAGE_QUEUED: 'sending_message',
    },
    recording: {
      USER_STOPPED_RECORDING: 'idle',
      USER_STARTED_TYPING: 'typing', // Cancel recording
      MESSAGE_QUEUED: 'sending_message',
    },
    sending_message: {
      AI_CALL_STARTED: 'ai_processing',
      ERROR_OCCURRED: 'error',
      // Allow going back to idle if message sent but no AI call yet (e.g. offline)
      MESSAGE_QUEUED: 'sending_message',
      USER_STARTED_TYPING: 'typing',
    },
    ai_processing: {
      AI_RESPONSE_STREAMING: 'ai_streaming',
      ERROR_OCCURRED: 'error',
    },
    ai_streaming: {
      AI_RESPONSE_COMPLETE: 'idle',
      USER_STARTED_TYPING: 'typing', // Cancel streaming
      USER_STARTED_RECORDING: 'recording', // Cancel streaming
      ERROR_OCCURRED: 'error',
    },
    error: {
      ERROR_RECOVERED: 'idle',
      USER_STARTED_TYPING: 'typing', // Recover on action
      USER_STARTED_RECORDING: 'recording', // Recover on action
    },
  };

  transition(event: ConversationEvent): boolean {
    const nextState = this.transitions[this.state]?.[event.type];

    if (!nextState) {
      console.warn(`Invalid transition: ${this.state} + ${event.type}`);
      return false;
    }

    this.onExit(this.state, event);
    const previousState = this.state;
    this.state = nextState;
    this.onEnter(nextState, event, previousState);

    this.listeners.forEach(listener => listener(nextState));
    return true;
  }

  private onExit(state: ConversationState, event: ConversationEvent) {
    // Side effects when exiting state
    if ((state === 'typing' || state === 'recording') && event.type === 'MESSAGE_QUEUED') {
      // Clear activity timers if needed
    }

    if (
      state === 'ai_streaming' &&
      (event.type === 'USER_STARTED_TYPING' || event.type === 'USER_STARTED_RECORDING')
    ) {
      // Cancel AI stream logic could be triggered here or by the caller observing the state change
    }
  }

  private onEnter(
    _state: ConversationState,
    _event: ConversationEvent,
    _previousState: ConversationState
  ) {
    // Side effects when entering state
  }

  getState(): ConversationState {
    return this.state;
  }

  subscribe(listener: (state: ConversationState) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
}
