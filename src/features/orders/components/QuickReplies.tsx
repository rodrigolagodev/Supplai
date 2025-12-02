'use client';

import { Button } from '@/components/ui/button';

interface QuickReply {
  id: string;
  label: string;
  action: 'message' | 'finish';
  message?: string;
}

const QUICK_REPLIES: QuickReply[] = [
  { id: '1', label: 'Eso es todo', action: 'finish' },
  { id: '2', label: 'Agregar más', action: 'message', message: 'Quiero agregar más productos' },
  {
    id: '3',
    label: 'Productos frecuentes',
    action: 'message',
    message: 'Muéstrame mis productos frecuentes',
  },
];

interface Props {
  onSelect: (reply: QuickReply) => void;
  disabled?: boolean;
}

export function QuickReplies({ onSelect, disabled }: Props) {
  return (
    <div className="flex gap-2 flex-wrap px-4 py-2">
      {QUICK_REPLIES.map(reply => (
        <Button
          key={reply.id}
          variant="outline"
          size="sm"
          onClick={() => onSelect(reply)}
          disabled={disabled}
          className="rounded-full text-xs h-8"
        >
          {reply.label}
        </Button>
      ))}
    </div>
  );
}
