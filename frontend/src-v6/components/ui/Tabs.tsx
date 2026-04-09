/**
 * SITREP v6 - Tabs Component
 * ==========================
 * Navegación por pestañas con variantes
 */

import React, { useState, forwardRef, createContext, useContext } from 'react';
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
  
  const isControlled = controlledActiveTab !== undefined;
  const activeTab = isControlled ? controlledActiveTab : activeTabState;

  const setActiveTab = (id: string) => {
    if (!isControlled) {
      setActiveTabState(id);
    }
    onChange?.(id);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab, variant }}>
      <div className={cn('w-full', className)}>{children}</div>
    </TabsContext.Provider>
  );
}

// ========================================
// TAB LIST
// ========================================
export function TabList({ children, className }: TabListProps) {
  const { variant } = useTabs();

  const variantStyles = {
    default: 'border-b border-neutral-200 gap-1',
    pills: 'gap-2 p-1 bg-neutral-100 rounded-xl',
    underline: 'border-b border-neutral-200 gap-6',
    bordered: 'gap-0 border border-neutral-200 rounded-lg p-1 bg-neutral-50',
  };

  return (
    <div className={cn('flex items-center overflow-x-auto scrollbar-hide max-w-full', variantStyles[variant], className)} role="tablist">
      {children}
    </div>
  );
}

// ========================================
// TAB
// ========================================
export function Tab({ id, children, disabled, icon, badge }: TabProps) {
  const { activeTab, setActiveTab, variant } = useTabs();
  const isActive = activeTab === id;

  const handleClick = () => {
    if (!disabled) {
      setActiveTab(id);
    }
  };

  const variantStyles = {
    default: cn(
      'px-2.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all whitespace-nowrap shrink-0',
      isActive
        ? 'border-primary-500 text-primary-600'
        : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
    ),
    pills: cn(
      'px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg transition-all whitespace-nowrap shrink-0',
      isActive
        ? 'bg-white text-primary-600 shadow-sm'
        : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50'
    ),
    underline: cn(
      'px-1 py-2 sm:py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all -mb-px whitespace-nowrap shrink-0',
      isActive
        ? 'border-primary-500 text-primary-600'
        : 'border-transparent text-neutral-500 hover:text-neutral-700'
    ),
    bordered: cn(
      'px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md transition-all flex-1 text-center whitespace-nowrap',
      isActive
        ? 'bg-white text-primary-600 shadow-sm border border-neutral-200'
        : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
    ),
  };

  return (
    <button
      role="tab"
      aria-selected={isActive}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        'flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/20',
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
  const { activeTab } = useTabs();
  const isActive = activeTab === id;

  if (!isActive) return null;

  return (
    <div
      role="tabpanel"
      className="py-4 animate-in fade-in slide-in-from-bottom-2 duration-200"
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
