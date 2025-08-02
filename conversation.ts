import type { ConversationHistory, ConversationContext, Message } from './types';

export class ConversationManager {
  private history: ConversationHistory;
  private context: ConversationContext;

  constructor(maxTurns: number = 5) {
    this.history = {
      messages: [],
      maxTurns
    };
    this.context = {};
  }

  addMessage(role: 'user' | 'assistant', content: string) {
    const message: Message = { role, content };
    this.history.messages.push(message);

    // Maintain conversation window size
    if (this.history.messages.length > this.history.maxTurns * 2) {
      this.history.messages = this.history.messages.slice(-this.history.maxTurns * 2);
    }
  }

  updateContext(context: Partial<ConversationContext>) {
    this.context = { ...this.context, ...context };
  }

  getContextualPrompt(basePrompt: string): string {
    const contextualInfo = [];
    
    if (this.context.previousQuery) {
      contextualInfo.push(`Previous query: "${this.context.previousQuery}"`);
    }
    if (this.context.previousSQL) {
      contextualInfo.push(`Previous SQL: ${this.context.previousSQL}`);
    }
    if (this.context.previousResults) {
      contextualInfo.push(`Previous results: ${JSON.stringify(this.context.previousResults?.slice(0, 2))}`);
    }

    const conversationHistory = this.history.messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    return `${basePrompt}\n\nConversation history:\n${conversationHistory}\n\nContext:\n${contextualInfo.join('\n')}`;
  }

  clear() {
    this.history.messages = [];
    this.context = {};
  }
}