'use client';

import { useEffect, useRef, useState } from 'react';
import Portal from '../../ui/portal/Portal';
import { cn } from '../../lib/utils';

interface SidebarMenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}

interface SidebarMenuProps {
  anchorRef: React.RefObject<HTMLElement>;
  items: SidebarMenuItem[];
  onClose: () => void;
}

const SidebarMenu = ({ anchorRef, items, onClose }: SidebarMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    direction: 'top' | 'bottom';
  }>({
    top: 0,
    left: 0,
    direction: 'bottom',
  });

  const timeoutId = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const menuHeight = items.length * 36 + 8; // approx height per item + padding
    const spaceBelow = window.innerHeight - rect.bottom;

    const direction = spaceBelow >= menuHeight ? 'bottom' : 'top';
    const top = direction === 'bottom' ? rect.bottom - 36 : rect.top - menuHeight + 42;

    setPosition({
      top,
      left: rect.right + 4,
      direction,
    });
  }, [anchorRef, items.length]);

  return (
    <Portal>
      <div
        ref={menuRef}
        style={{
          position: 'fixed',
          top: position.top,
          left: position.left,
          zIndex: 9999,
        }}
        onMouseEnter={() => {
          if (timeoutId.current) clearTimeout(timeoutId.current);
        }}
        onMouseLeave={() => {
          timeoutId.current = setTimeout(() => {
            onClose();
          }, 200);
        }}
        className={cn(
          'bg-white border border-gray-200 shadow-lg rounded-md text-xs text-gray-800 w-52 p-1',
        )}
      >
        {items.map((item, index) => (
          <div
            key={index}
            className={cn(
              'px-2 py-2 rounded-md cursor-pointer hover:bg-gray-100 flex items-center justify-between',
              item.disabled && 'text-gray-400 cursor-not-allowed',
              item.danger && !item.disabled && 'text-red-600',
            )}
            onClick={() => {
              if (!item.disabled) {
                item.onClick();
                onClose();
              }
            }}
          >
            {item.label}
          </div>
        ))}
      </div>
    </Portal>
  );
};

export default SidebarMenu;
