/**
 * SITREP v6 - DatePicker Component
 * =================================
 * Selector de fechas simple y range
 */

import React, { useState, useRef, useEffect } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ========================================
// UTILS
// ========================================
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

// ========================================
// TYPES
// ========================================
interface DatePickerProps {
  value?: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  className?: string;
}

// ========================================
// COMPONENT
// ========================================
export function DatePicker({
  value,
  onChange,
  placeholder = 'Seleccionar fecha',
  minDate,
  maxDate,
  disabled,
  className,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(value || new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1));
  };

  const handleSelectDate = (day: number) => {
    const selected = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    onChange(selected);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  const isDateDisabled = (day: number): boolean => {
    const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  const renderCalendar = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const days: React.ReactNode[] = [];

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="w-10 h-10" />);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isSelected = value && isSameDay(date, value);
      const isToday = isSameDay(date, new Date());
      const isDisabled = isDateDisabled(day);

      days.push(
        <button
          key={day}
          type="button"
          disabled={isDisabled}
          onClick={() => handleSelectDate(day)}
          className={cn(
            'w-10 h-10 rounded-lg text-sm font-medium transition-colors',
            'hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500/20',
            isSelected && 'bg-primary-500 text-white hover:bg-primary-600',
            isToday && !isSelected && 'text-primary-600 font-semibold border border-primary-200',
            isDisabled && 'opacity-40 cursor-not-allowed hover:bg-transparent'
          )}
        >
          {day}
        </button>
      );
    }

    return days;
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'w-full flex items-center gap-3 px-4 h-10 rounded-xl border transition-all',
          'bg-white text-left text-sm',
          'border-neutral-200 hover:border-neutral-300',
          'focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10',
          disabled && 'opacity-50 cursor-not-allowed bg-neutral-50',
          isOpen && 'border-primary-500 ring-4 ring-primary-500/10',
          !value && 'text-neutral-400'
        )}
      >
        <Calendar size={18} className={cn('shrink-0', value ? 'text-primary-500' : 'text-neutral-400')} />
        <span className="flex-1 truncate">
          {value ? formatDate(value) : placeholder}
        </span>
        {value && !disabled && (
          <X
            size={16}
            onClick={handleClear}
            className="shrink-0 text-neutral-400 hover:text-neutral-600"
          />
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 p-4 bg-white rounded-xl shadow-4 border border-neutral-200 z-50 min-w-[280px]">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              <ChevronLeft size={20} className="text-neutral-600" />
            </button>
            <span className="font-semibold text-neutral-900">
              {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              <ChevronRight size={20} className="text-neutral-600" />
            </button>
          </div>

          {/* Weekdays */}
          <div className="grid grid-cols-7 mb-2">
            {WEEKDAYS.map((day) => (
              <div key={day} className="w-10 h-10 flex items-center justify-center text-xs font-medium text-neutral-500">
                {day}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-0.5">
            {renderCalendar()}
          </div>
        </div>
      )}
    </div>
  );
}

// ========================================
// DATE RANGE PICKER
// ========================================
interface DateRangePickerProps {
  startDate?: Date | null;
  endDate?: Date | null;
  onChange: (start: Date | null, end: Date | null) => void;
  placeholder?: string;
  className?: string;
}

export function DateRangePicker({
  startDate,
  endDate,
  onChange,
  placeholder = 'Seleccionar período',
  className,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selecting, setSelecting] = useState<'start' | 'end'>('start');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (date: Date) => {
    if (selecting === 'start') {
      onChange(date, null);
      setSelecting('end');
    } else {
      if (startDate && date < startDate) {
        onChange(date, startDate);
      } else {
        onChange(startDate, date);
      }
      setIsOpen(false);
      setSelecting('start');
    }
  };

  const formatRange = () => {
    if (!startDate) return placeholder;
    if (!endDate) return `${formatDate(startDate)} - ...`;
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center gap-3 px-4 h-10 rounded-xl border transition-all',
          'bg-white text-left text-sm',
          'border-neutral-200 hover:border-neutral-300',
          'focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10',
          isOpen && 'border-primary-500 ring-4 ring-primary-500/10',
          !startDate && 'text-neutral-400'
        )}
      >
        <Calendar size={18} className={cn('shrink-0', startDate ? 'text-primary-500' : 'text-neutral-400')} />
        <span className="flex-1 truncate">{formatRange()}</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 p-4 bg-white rounded-xl shadow-4 border border-neutral-200 z-50">
          <p className="text-sm text-neutral-600 mb-3">
            {selecting === 'start' ? 'Seleccionar fecha inicial' : 'Seleccionar fecha final'}
          </p>
          <DatePicker
            value={selecting === 'start' ? startDate : endDate || undefined}
            onChange={handleSelect}
          />
        </div>
      )}
    </div>
  );
}

export default DatePicker;
