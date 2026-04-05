/**
 * Tests for src-v6/components/ErrorBoundary.tsx
 * Class component that catches render errors
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../../components/ErrorBoundary';

// A component that throws conditionally via a ref-like external flag
let shouldThrow = false;

function ThrowingChild() {
  if (shouldThrow) {
    throw new Error('Test explosion');
  }
  return <div>Child content</div>;
}

describe('ErrorBoundary', () => {
  // Suppress React error boundary console.error noise in test output
  const originalError = console.error;
  beforeEach(() => {
    shouldThrow = false;
    console.error = vi.fn();
  });
  afterEach(() => {
    console.error = originalError;
  });

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Safe content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('Safe content')).toBeInTheDocument();
  });

  it('renders fallback UI when a child throws', () => {
    shouldThrow = true;
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    );
    expect(screen.getByText(/Algo sali. mal/)).toBeInTheDocument();
    expect(screen.getByText(/error inesperado/)).toBeInTheDocument();
  });

  it('shows "Recargar pagina" and "Intentar de nuevo" buttons', () => {
    shouldThrow = true;
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    );
    expect(screen.getByText(/Recargar p.gina/)).toBeInTheDocument();
    expect(screen.getByText(/Intentar de nuevo/)).toBeInTheDocument();
  });

  it('recovers when "Intentar de nuevo" is clicked and child no longer throws', () => {
    shouldThrow = true;

    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    );
    expect(screen.getByText(/Algo sali. mal/)).toBeInTheDocument();

    // Stop throwing, then click "Intentar de nuevo" which calls handleReset
    shouldThrow = false;
    fireEvent.click(screen.getByText(/Intentar de nuevo/));

    // After reset, ErrorBoundary re-renders children — ThrowingChild no longer throws
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });
});
