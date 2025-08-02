export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface ConversationHistory {
  messages: Message[];
  maxTurns: number;
}

export interface ConversationContext {
  previousQuery?: string;
  previousSQL?: string;
  previousResults?: any[];
}