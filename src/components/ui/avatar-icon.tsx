import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getTerminalIcon } from '@/config/terminalIcons';
import { cn } from '@/lib/utils';

interface AvatarIconProps {
  terminalType: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showLabel?: boolean;
}

const sizeMap = {
  xs: {
    avatar: 'w-6 h-6',
    icon: 'w-3 h-3',
    text: 'text-[8px]',
  },
  sm: {
    avatar: 'w-8 h-8',
    icon: 'w-4 h-4',
    text: 'text-xs',
  },
  md: {
    avatar: 'w-10 h-10',
    icon: 'w-5 h-5',
    text: 'text-sm',
  },
  lg: {
    avatar: 'w-12 h-12',
    icon: 'w-6 h-6',
    text: 'text-base',
  },
  xl: {
    avatar: 'w-16 h-16',
    icon: 'w-8 h-8',
    text: 'text-lg',
  },
};

export function AvatarIcon({ 
  terminalType, 
  size = 'md', 
  className,
  showLabel = false,
}: AvatarIconProps) {
  const config = getTerminalIcon(terminalType);
  const Icon = config.icon;
  const sizes = sizeMap[size];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Avatar
        className={cn(sizes.avatar, 'border-2')}
        style={{
          background: config.bgGradient,
          borderColor: config.color,
        }}
      >
        <AvatarFallback
          className="bg-transparent"
          style={{ color: 'white' }}
        >
          <Icon className={sizes.icon} strokeWidth={2.5} />
        </AvatarFallback>
      </Avatar>
      {showLabel && (
        <span 
          className={cn('font-medium', sizes.text)}
          style={{ color: config.color }}
        >
          {config.label}
        </span>
      )}
    </div>
  );
}

// Variant for inline use (just the icon, no avatar wrapper)
export function InlineTerminalIcon({
  terminalType,
  size = 'md',
  className,
}: Omit<AvatarIconProps, 'showLabel'>) {
  const config = getTerminalIcon(terminalType);
  const Icon = config.icon;
  const sizes = sizeMap[size];

  return (
    <Icon
      className={cn(sizes.icon, className)}
      style={{ color: config.color }}
      strokeWidth={2.5}
    />
  );
}
