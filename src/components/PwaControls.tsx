import React, { useEffect, useState } from 'react';
import { Download, WifiOff } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return outcome === 'accepted';
  };

  return { canInstall: Boolean(deferredPrompt) && !isInstalled, isInstalled, promptInstall };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return isOnline;
}

export const PWAInstallButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { canInstall, promptInstall } = usePWAInstall();
  if (!canInstall) return null;

  return (
    <button
      type="button"
      onClick={promptInstall}
      aria-label="Install Lumina Studio App"
      className={`px-2.5 py-1.5 rounded-md text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 flex items-center gap-1.5 whitespace-nowrap ${className}`}
    >
      <Download className="w-3.5 h-3.5" />
      <span>Install App</span>
    </button>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-50 px-3 py-1.5 rounded-lg bg-zinc-900/95 border border-amber-500/40 text-xs text-amber-200 flex items-center gap-2 shadow-xl"
    >
      <WifiOff className="w-3.5 h-3.5 text-amber-400" />
      <span>Offline Mode Active · Editing locally</span>
    </div>
  );
};
