import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { getTelegramApp } from '@/platform/telegram';

// eslint-disable-next-line react-refresh/only-export-components -- Shared native Back lifecycle for Radix surfaces and the existing Create drawer.
export function useDiscoveryBack(open: boolean, onBack: () => void) {
  const callback = useRef(onBack); callback.current = onBack;
  useEffect(() => {
    if (!open) return;
    const button = getTelegramApp()?.BackButton;
    if (!button) return;
    const back = () => callback.current();
    button.show(); button.onClick(back);
    return () => { button.offClick(back); button.hide(); };
  }, [open]);
}

export function DiscoverySurface({ open, title, description, onClose, children, initialFocus, kind }: {
  open: boolean; title: string; description: string; onClose: () => void; children: ReactNode;
  initialFocus?: RefObject<HTMLInputElement>; kind?: string;
}) {
  const opener = useRef<HTMLElement | null>(null);
  useDiscoveryBack(open, onClose);
  return <Dialog.Root open={open} onOpenChange={next => { if (!next) onClose(); }}>
    <Dialog.Portal><Dialog.Overlay className="discovery-surface-overlay" />
      <Dialog.Content className={`discovery-surface${kind ? ' discovery-surface-' + kind : ''}`}
        onOpenAutoFocus={event => {
          const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          // Keep the original dock opener when this surface returns from city.
          if (active && active !== document.body && (!opener.current?.isConnected || !active.closest('[role="dialog"]'))) opener.current = active;
          if (initialFocus?.current) { event.preventDefault(); initialFocus.current.focus(); }
        }}
        onCloseAutoFocus={event => {
          event.preventDefault();
          // A city opened from Profile replaces a dialog. Do not steal its focus.
          queueMicrotask(() => { if (document.querySelector('[role="dialog"]')) return; const target = opener.current?.isConnected ? opener.current : document.querySelector<HTMLElement>('[data-discovery-focus]'); target?.focus({ preventScroll: true }); });
        }}>
        <header className="discovery-surface-header"><Dialog.Title>{title}</Dialog.Title><Dialog.Close asChild><button type="button" className="app-account-action">Close</button></Dialog.Close></header>
        <Dialog.Description className="discovery-surface-description">{description}</Dialog.Description>
        <div className="discovery-surface-scroll">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
