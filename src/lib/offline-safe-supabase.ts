import { supabase } from './supabase';
import { syncQueue, isOnline } from './offline-sync';
import { toast } from 'sonner';

export const offlineSafeSupabase = {
  async insert(table: string, data: any) {
    if (isOnline()) {
      try {
        const { data: result, error } = await supabase.from(table).insert(data).select().single();
        if (error) throw error;
        return { data: result, error: null };
      } catch (err: any) {
        console.error('Supabase Error, falling back to queue:', err);
        // If it's a network error, queue it
        if (!navigator.onLine || err.message?.includes('fetch')) {
          await syncQueue.addItem({ table, action: 'INSERT', data });
          toast.info('Offline: Added to sync queue');
          return { data: { ...data, id: 'temp-' + Math.random() }, error: null, queued: true };
        }
        return { data: null, error: err };
      }
    } else {
      await syncQueue.addItem({ table, action: 'INSERT', data });
      toast.info('Offline: Added to sync queue');
      return { data: { ...data, id: 'temp-' + Math.random() }, error: null, queued: true };
    }
  },

  async update(table: string, data: any, filter: { column: string, value: any }) {
    if (isOnline()) {
      try {
        const { data: result, error } = await supabase.from(table).update(data).eq(filter.column, filter.value).select();
        if (error) throw error;
        return { data: result, error: null };
      } catch (err: any) {
        console.error('Supabase Error, falling back to queue:', err);
        if (!navigator.onLine || err.message?.includes('fetch')) {
          await syncQueue.addItem({ table, action: 'UPDATE', data, filter });
          toast.info('Offline: Update added to sync queue');
          return { data: null, error: null, queued: true };
        }
        return { data: null, error: err };
      }
    } else {
      await syncQueue.addItem({ table, action: 'UPDATE', data, filter });
      toast.info('Offline: Update added to sync queue');
      return { data: null, error: null, queued: true };
    }
  },

  async delete(table: string, filter: { column: string, value: any }) {
    if (isOnline()) {
      try {
        const { error } = await supabase.from(table).delete().eq(filter.column, filter.value);
        if (error) throw error;
        return { error: null };
      } catch (err: any) {
        console.error('Supabase Error, falling back to queue:', err);
        if (!navigator.onLine || err.message?.includes('fetch')) {
          await syncQueue.addItem({ table, action: 'DELETE', data: null, filter });
          toast.info('Offline: Deletion added to sync queue');
          return { error: null, queued: true };
        }
        return { error: err };
      }
    } else {
      await syncQueue.addItem({ table, action: 'DELETE', data: null, filter });
      toast.info('Offline: Deletion added to sync queue');
      return { error: null, queued: true };
    }
  },

  async processQueue() {
    if (!isOnline()) return;

    const queue = await syncQueue.getItems();
    if (queue.length === 0) return;

    toast.loading(`Syncing ${queue.length} pending changes...`, { id: 'sync-toast' });

    for (const item of queue) {
      try {
        let error = null;
        if (item.action === 'INSERT') {
          ({ error } = await (supabase.from(item.table as any) as any).insert(item.data));
        } else if (item.action === 'UPDATE') {
          ({ error } = await (supabase.from(item.table as any) as any).update(item.data).eq(item.filter.column, item.filter.value));
        } else if (item.action === 'DELETE') {
          ({ error } = await (supabase.from(item.table as any) as any).delete().eq(item.filter.column, item.filter.value));
        }

        if (!error) {
          await syncQueue.removeItem(item.id);
        } else {
          console.error(`Failed to sync item ${item.id}:`, error);
        }
      } catch (err) {
        console.error(`Sync error for item ${item.id}:`, err);
        break; // Stop processing if we hit a network error again
      }
    }

    const remaining = await syncQueue.getItems();
    if (remaining.length === 0) {
      toast.success('All changes synced!', { id: 'sync-toast' });
    } else {
      toast.error(`${remaining.length} changes failed to sync.`, { id: 'sync-toast' });
    }
  }
};

// Auto-sync when coming back online
window.addEventListener('online', () => {
    offlineSafeSupabase.processQueue();
});
