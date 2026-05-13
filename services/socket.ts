type EventHandler = (...args: any[]) => void;

class MockSocketService {
  private listeners: Record<string, EventHandler[]> = {};
  private connected = false;
  private typingTimers: Record<string, ReturnType<typeof setTimeout>> = {};

  on(event: string, handler: EventHandler) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }

  off(event: string, handler: EventHandler) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(h => h !== handler);
  }

  emit(event: string, ...args: any[]) {
    (this.listeners[event] || []).forEach(h => h(...args));
  }

  connect(_token: string) {
    setTimeout(() => {
      this.connected = true;
      this.emit('connect');
    }, 500);
  }

  disconnect() {
    this.connected = false;
    this.emit('disconnect');
  }

  joinConversation(_conversationId: string) {}

  sendMessage(conversationId: string, content: string) {
    if (!this.connected) return;
    setTimeout(() => {
      this.emit('message:delivered', { conversationId, timestamp: new Date() });
    }, 100);
  }

  simulateIncomingMessage(conversationId: string, senderId: string, content: string) {
    this.emit('message:new', {
      id: `msg_${Date.now()}`,
      conversationId,
      senderId,
      content,
      type: 'text',
      timestamp: new Date(),
      read: false,
    });
  }

  simulateTyping(conversationId: string, userId: string) {
    this.emit('typing:start', { conversationId, userId });
    if (this.typingTimers[conversationId]) {
      clearTimeout(this.typingTimers[conversationId]);
    }
    this.typingTimers[conversationId] = setTimeout(() => {
      this.emit('typing:stop', { conversationId, userId });
    }, 3000);
  }

  isConnected() {
    return this.connected;
  }
}

export const socketService = new MockSocketService();
