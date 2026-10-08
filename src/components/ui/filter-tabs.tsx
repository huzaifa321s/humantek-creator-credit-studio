'use client';

import * as React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsBadge } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export interface FilterTabItem<T extends string = string> {
  value: T;
  label: string;
  count?: number;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface FilterTabsProps<T extends string = string> {
  value: T;
  onValueChange: (value: T) => void;
  tabs: FilterTabItem<T>[];
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'line' | 'soft';
  className?: string;
  listClassName?: string;
  children?: React.ReactNode;
}

export function FilterTabs<T extends string = string>({
  value,
  onValueChange,
  tabs,
  size = 'sm',
  variant = 'default',
  className,
  listClassName,
  children,
}: FilterTabsProps<T>) {
  return (
    <Tabs
      value={value}
      onValueChange={(val) => onValueChange(val as T)}
      className={cn('w-full overflow-x-auto scrollbar-none', className)}
    >
      <TabsList variant={variant} size={size} className={cn('w-auto min-w-0 flex-nowrap justify-start', listClassName)}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              variant={variant}
              size={size}
              className="whitespace-nowrap shrink-0"
            >
              {Icon && <Icon className="size-3.5 shrink-0" />}
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <TabsBadge count={tab.count} />
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {children}
    </Tabs>
  );
}
