import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCw } from 'lucide-react';

// Extend the Window interface to include workbox
export interface Window {
  workbox?: {
    addEventListener: (event: string, callback: () => void) => void;
    removeEventListener: (event: string, callback: () => void) => void;
    register: () => Promise<void>;
  };
}

export function ServiceWorkerUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const handleControllerChange = () => {
      window.location.reload();
    };

    const handleUpdateFound = () => {
      const installingWorker = navigator.serviceWorker.controller;
      if (installingWorker) {
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            setUpdateAvailable(true);
          }
        };
      }
    };

    // Check for updates immediately
    navigator.serviceWorker.getRegistration().then(registration => {
      if (registration) {
        registration.update().catch((err) => {
          // Ignore InvalidStateError often thrown in dev when SW is in a bad state
          if (err && err.name === 'InvalidStateError') return;
          console.error(err);
        });
      }
    });

    // Listen for controller change
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    
    // Listen for update found
    navigator.serviceWorker.addEventListener('updatefound', handleUpdateFound);

    // Check for updates every hour
    const updateInterval = setInterval(() => {
      navigator.serviceWorker.getRegistration().then(registration => {
        if (registration) {
          registration.update().catch((err) => {
            if (err && err.name === 'InvalidStateError') return;
            console.error(err);
          });
        }
      });
    }, 60 * 60 * 1000);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      navigator.serviceWorker.removeEventListener('updatefound', handleUpdateFound);
      clearInterval(updateInterval);
    };
  }, []);

  const handleUpdate = () => {
    setIsRefreshing(true);
    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        if (registration.waiting) {
          // Send message to the waiting service worker
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    }
  };

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded shadow-lg flex items-center">
        <div className="flex-1">
          <p className="font-medium">New update available!</p>
          <p className="text-sm">Refresh to get the latest version of the app.</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleUpdate}
          disabled={isRefreshing}
          className="ml-4 bg-white hover:bg-yellow-50"
        >
          {isRefreshing ? (
            <>
              <RotateCw className="mr-2 h-4 w-4 animate-spin" />
              Updating...
            </>
          ) : 'Update Now'}
        </Button>
      </div>
    </div>
  );
}
