import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import './CustomSelect.css';

interface Option {
    value: string;
    label: string;
}

interface CustomSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    icon?: React.ReactNode;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
    options,
    value,
    onChange,
    placeholder = 'Seleccionar...',
    icon
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
    };

    return (
        <div className="custom-select" ref={containerRef}>
            <button
                type="button"
                className={`custom-select-trigger ${isOpen ? 'open' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                {icon && <span className="custom-select-icon">{icon}</span>}
                <span className="custom-select-value">
                    {selectedOption?.label || placeholder}
                </span>
                <ChevronDown
                    size={18}
                    className={`custom-select-arrow ${isOpen ? 'rotated' : ''}`}
                />
            </button>

            {isOpen && (
                <div className="custom-select-dropdown" role="listbox">
                    {options.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            className={`custom-select-option ${option.value === value ? 'selected' : ''}`}
                            onClick={() => handleSelect(option.value)}
                            role="option"
                            aria-selected={option.value === value}
                        >
                            <span className="option-label">{option.label}</span>
                            {option.value === value && (
                                <Check size={18} className="option-check" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CustomSelect;
