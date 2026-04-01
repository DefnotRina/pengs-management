import { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCcw, CircleCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { subscribeToOnlineStatus, syncQueue } from '../lib/offline-sync';

export const OfflineStatus = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingCount, setPendingCount] = useState(0);

    useEffect(() => {
        const unsubscribe = subscribeToOnlineStatus(setIsOnline);
        const handleSyncChange = (e: any) => setPendingCount(e.detail.count);
        
        window.addEventListener('sync-queue-changed', handleSyncChange);
        
        // Initial count
        syncQueue.getItems().then(items => setPendingCount(items.length));

        return () => {
            unsubscribe();
            window.removeEventListener('sync-queue-changed', handleSyncChange);
        };
    }, []);

    if (isOnline && pendingCount === 0) return null;

    return (
        <div className={cn(
            "fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-full shadow-lg border transition-all duration-300 animate-in fade-in slide-in-from-bottom-4",
            isOnline ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-orange-50 border-orange-200 text-orange-700"
        )}>
            {isOnline ? (
                <>
                    <RefreshCcw className="h-4 w-4 animate-spin-slow" />
                    <span className="text-[10px] font-bold uppercase tracking-tight">Syncing {pendingCount} Pending...</span>
                </>
            ) : (
                <>
                    <WifiOff className="h-4 w-4" />
                    <span className="text-[10px] font-bold uppercase tracking-tight">Offline {pendingCount > 0 && `(${pendingCount} Pending)`}</span>
                </>
            )}
        </div>
    );
};

// Add to your global CSS for smooth animation
// .animate-spin-slow { animation: spin 3s linear infinite; }
