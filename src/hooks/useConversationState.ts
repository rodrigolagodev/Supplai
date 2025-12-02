import { useSyncExternalStore } from 'react';
import { ConversationStateMachine, ConversationEvent } from '@/lib/state/ConversationStateMachine';

let stateMachine: ConversationStateMachine | null = null;

function getStateMachine() {
  if (!stateMachine) {
    stateMachine = new ConversationStateMachine();
  }
  return stateMachine;
}

export function useConversationState() {
  const machine = getStateMachine();

  const state = useSyncExternalStore(
    callback => machine.subscribe(callback),
    () => machine.getState(),
    () => machine.getState() // Server snapshot
  );

  const dispatch = (event: ConversationEvent) => {
    machine.transition(event);
  };

  return { state, dispatch };
}
