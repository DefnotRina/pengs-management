import { get, set, del } from 'idb-keyval';

export interface PendingMutation {
  id: string;
  table: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  data: any;
  filter?: any;
  timestamp: number;
}

const QUEUE_KEY = 'supabase-sync-queue';

export const syncQueue = {
  async getItems(): Promise<PendingMutation[]> {
    return (await get(QUEUE_KEY)) || [];
  },

  async addItem(item: Omit<PendingMutation, 'id' | 'timestamp'>) {
    const queue = await this.getItems();
    const newItem: PendingMutation = {
      ...item,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
    };
    queue.push(newItem);
    await set(QUEUE_KEY, queue);
    
    // Dispatch custom event to notify UI
    window.dispatchEvent(new CustomEvent('sync-queue-changed', { detail: { count: queue.length } }));
    
    return newItem;
  },

  async removeItem(id: string) {
    const queue = await this.getItems();
    const newQueue = queue.filter((i) => i.id !== id);
    await set(QUEUE_KEY, newQueue);
    
    window.dispatchEvent(new CustomEvent('sync-queue-changed', { detail: { count: newQueue.length } }));
  },

  async clear() {
    await del(QUEUE_KEY);
    window.dispatchEvent(new CustomEvent('sync-queue-changed', { detail: { count: 0 } }));
  }
};

export const isOnline = () => navigator.onLine;

// Simple store for online status
let onlineStatus = navigator.onLine;
const listeners: ((status: boolean) => void)[] = [];

export const subscribeToOnlineStatus = (callback: (status: boolean) => void) => {
  listeners.push(callback);
  return () => {
    const index = listeners.indexOf(callback);
    if (index > -1) listeners.splice(index, 1);
  };
};

window.addEventListener('online', () => {
  onlineStatus = true;
  listeners.forEach((l) => l(true));
});

window.addEventListener('offline', () => {
  onlineStatus = false;
  listeners.forEach((l) => l(false));
});
