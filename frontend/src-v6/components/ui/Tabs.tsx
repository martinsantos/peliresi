/**
 * SITREP v6 - Tabs Component
 * ==========================
 * Navegación por pestañas con variantes
 */

import React, { useState, useId, useRef, useLayoutEffect, createContext, useContext } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ========================================
// CONTEXT
// ========================================
interface TabsContextType {
  activeTab: string;
  setActiveTab: (id: string) => void;
  variant: TabsVariant;
  instanceId: string;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

function useTabs() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs provider');
  }
  return context;
}

// ========================================
// TYPES
// ========================================
type TabsVariant = 'default' | 'pills' | 'underline' | 'bordered';

interface TabsProps {
  defaultTab?: string;
  activeTab?: string;
  onChange?: (id: string) => void;
  variant?: TabsVariant;
  children: React.ReactNode;
  className?: string;
}

interface TabListProps {
  children: React.ReactNode;
  className?: string;
}

interface TabProps {
  id: string;
  children: React.ReactNode;
  disabled?: boolean;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

interface TabPanelProps {
  id: string;
  children: React.ReactNode;
}

// ========================================
// TABS ROOT
// ========================================
export function Tabs({
  defaultTab,
  activeTab: controlledActiveTab,
  onChange,
  variant = 'default',
  children,
  className,
}: TabsProps) {
  const [activeTabState, setActiveTabState] = useState(defaultTab || '');
  const instanceId = useId();
  
  const isControlled = controlledActiveTab !== undefined;
  const activeTab = isControlled ? controlledActiveTab : activeTabState;

  const setActiveTab = (id: string) => {
    if (!isControlled) {
      setActiveTabState(id);
    }
    onChange?.(id);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab, variant, instanceId }}>
      <div className={cn('w-full', className)}>{children}</div>
    </TabsContext.Provider>
  );
}

// ========================================
// TAB LIST
// ========================================
export function TabList({ children, className }: TabListProps) {
  const { variant, activeTab } = useTabs();
  const listRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const reveal = () => {
      const selected = list.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
      if (!selected) return;
      const viewport = list.getBoundingClientRect();
      const bounds = selected.getBoundingClientRect();
      // Move only this strip. scrollIntoView would also move the form/page.
      const delta = bounds.width > viewport.width || bounds.left < viewport.left
        ? bounds.left - viewport.left
        : Math.max(0, bounds.right - viewport.right);
      if (delta) list.scrollLeft += delta;
    };
    reveal();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(reveal);
    observer.observe(list);
    return () => observer.disconnect();
  }, [activeTab]);

  const variantStyles = {
    default: 'border-b border-neutral-200 gap-1',
    pills: 'gap-2 p-1 bg-neutral-100 rounded-xl',
    underline: 'border-b border-neutral-200 gap-6',
    bordered: 'gap-0 border border-neutral-200 rounded-lg p-1 bg-neutral-50',
  };

  return (
    <div ref={listRef} className={cn('flex items-center overflow-x-auto scrollbar-hide max-w-full', variantStyles[variant], className)} role="tablist">
      {children}
    </div>
  );
}

// ========================================
// TAB
// ========================================
export function Tab({ id, children, disabled, icon, badge }: TabProps) {
  const { activeTab, setActiveTab, variant, instanceId } = useTabs();
  const isActive = activeTab === id;

  const handleClick = () => {
    if (!disabled) {
      setActiveTab(id);
    }
  };

  const variantStyles = {
    default: cn(
      'px-2.5 sm:px-4 py-2 sm:py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0',
      isActive
        ? 'border-primary-500 text-primary-700'
        : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
    ),
    pills: cn(
      'px-3 sm:px-4 py-1.5 sm:py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0',
      isActive
        ? 'bg-white text-primary-700 shadow-sm'
        : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50'
    ),
    underline: cn(
      'px-1 py-2 sm:py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap shrink-0',
      isActive
        ? 'border-primary-500 text-primary-700'
        : 'border-transparent text-neutral-500 hover:text-neutral-700'
    ),
    bordered: cn(
      'px-3 sm:px-4 py-1.5 sm:py-2 text-sm font-medium rounded-md transition-colors flex-1 text-center whitespace-nowrap',
      isActive
        ? 'bg-white text-primary-700 shadow-sm border border-neutral-200'
        : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
    ),
  };

  return (
    <button
      type="button"
      id={`${instanceId}-tab-${id}`}
      role="tab"
      aria-controls={`${instanceId}-panel-${id}`}
      aria-selected={isActive}
      aria-disabled={disabled}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const tabs = Array.from(event.currentTarget.closest('[role="tablist"]')?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)') || []);
        const index = tabs.indexOf(event.currentTarget);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        tabs[next]?.focus({ preventScroll: true });
        tabs[next]?.click();
      }}
      className={cn(
        'flex min-h-11 items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-700',
        variantStyles[variant],
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {icon && <span className="shrink-0 hidden sm:inline-flex">{icon}</span>}
      <span>{children}</span>
      {badge && <span className="shrink-0">{badge}</span>}
    </button>
  );
}

// ========================================
// TAB PANEL
// ========================================
export function TabPanel({ id, children }: TabPanelProps) {
  const { activeTab, instanceId } = useTabs();
  const isActive = activeTab === id;

  if (!isActive) return null;

  return (
    <div
      role="tabpanel"
      id={`${instanceId}-panel-${id}`}
      aria-labelledby={`${instanceId}-tab-${id}`}
      tabIndex={0}
      className="py-4"
    >
      {children}
    </div>
  );
}

// ========================================
// SIMPLE TABS (All-in-one)
// ========================================
export interface SimpleTab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  content: React.ReactNode;
}

interface SimpleTabsProps {
  tabs: SimpleTab[];
  defaultTab?: string;
  variant?: TabsVariant;
  className?: string;
}

export function SimpleTabs({ tabs, defaultTab, variant = 'default', className }: SimpleTabsProps) {
  return (
    <Tabs defaultTab={defaultTab || tabs[0]?.id} variant={variant} className={className}>
      <TabList>
        {tabs.map((tab) => (
          <Tab key={tab.id} id={tab.id} icon={tab.icon} badge={tab.badge}>
            {tab.label}
          </Tab>
        ))}
      </TabList>
      {tabs.map((tab) => (
        <TabPanel key={tab.id} id={tab.id}>
          {tab.content}
        </TabPanel>
      ))}
    </Tabs>
  );
}

export default Tabs;
