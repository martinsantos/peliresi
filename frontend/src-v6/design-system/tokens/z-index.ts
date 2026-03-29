/**
 * Centralized z-index tokens for SITREP.
 * Use these constants instead of hardcoded z-[N] values.
 *
 * Visual stacking order (lowest to highest):
 *   base → dropdown → stickyGroup → sticky → header → mobileHeader
 *   → sidebar → impersonation → backdrop → search → modal → toast → tour
 */

export const Z = {
  base: 0,
  dropdown: 10,
  stickyGroup: 5,    // group headers inside scroll containers
  sticky: 10,        // thead, filter bars within scroll containers
  filterBar: 20,     // page-level sticky filter bars
  header: 30,        // MainLayout top header
  mobileHeader: 40,  // MobileLayout header
  sidebar: 50,       // Sidebar toggle overlay
  impersonation: 60, // ImpersonationBanner
  backdrop: 900,     // Global search backdrop
  search: 901,       // Global search panel
  modal: 1000,       // Modals
  toast: 1100,       // Toast notifications
  tour: 9999,        // Onboarding tour overlay
} as const;

export type ZLevel = keyof typeof Z;
