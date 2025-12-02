import { useSyncExternalStore, useMemo } from 'react';
import { ConversationStateMachine, ConversationEvent } from '@/lib/state/ConversationStateMachine';

export function useConversationState() {
  // Create a new instance per component usage (scoped to the component lifecycle)
  const machine = useMemo(() => new ConversationStateMachine(), []);

  const state = useSyncExternalStore(
    callback => machine.subscribe(callback),
    () => machine.getState(),
    () => machine.getState() // Server snapshot
  );

  const dispatch = (event: ConversationEvent) => {
    machine.transition(event);
  };

  return { state, dispatch, machine };
}
