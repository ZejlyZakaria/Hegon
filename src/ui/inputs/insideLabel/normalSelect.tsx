"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

interface OptionType {
  label: string;
  value: string;
}

interface SelectProps {
  id: string;
  options: OptionType[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  dropdownHeight?: number;
}

export default function NormalSelect({
  id,
  options,
  value,
  onChange,
  className = "",
  disabled = false,
  dropdownHeight = 250,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [direction, setDirection] = useState<"up" | "down">("down");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const calculateDirection = () => {
    if (!containerRef.current) return "down";
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    return spaceBelow < dropdownHeight && spaceAbove > spaceBelow
      ? "up"
      : "down";
  };

  const toggleDropdown = () => {
    if (disabled) return;

    if (!isOpen) {
      setDirection(calculateDirection());
    }

    setIsOpen((prev) => !prev);
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative min-w-40 ${className}`}
    >
      {/* SELECT BOX */}
      <div
        id={id}
        tabIndex={disabled ? -1 : 0}
        onClick={toggleDropdown}
        className={`
          w-full px-4 py-2 text-xs rounded-lg border cursor-pointer
          transition-all duration-200 flex justify-between items-center
          bg-zinc-900 border-zinc-700 text-white
          hover:border-zinc-500
          ${isOpen ? "border-blue-500 ring-1 ring-blue-500" : ""}
          ${disabled ? "opacity-50 pointer-events-none" : ""}
        `}
      >
        <span className={selectedOption ? "text-white" : "text-zinc-500"}>
          {selectedOption?.label}
        </span>

        <ChevronDown
          size={16}
          className={`transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </div>

      {/* DROPDOWN */}
      {isOpen && (
        <div
          className="absolute w-full mt-1 rounded-lg border border-zinc-700 bg-zinc-900 shadow-lg z-50 overflow-y-auto"
          style={{
            maxHeight: dropdownHeight,
            top: direction === "down" ? "100%" : undefined,
            bottom: direction === "up" ? "100%" : undefined,
          }}
        >
          {options.length > 0 ? (
            options.map((option) => (
              <div
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={`
                  px-4 py-2 text-xs cursor-pointer
                  hover:bg-zinc-800
                  ${
                    value === option.value
                      ? "text-blue-500 font-medium"
                      : "text-white"
                  }
                `}
              >
                {option.label}
              </div>
            ))
          ) : (
            <div className="px-4 py-2 text-xs text-zinc-500 italic">
              Aucune option disponible
            </div>
          )}
        </div>
      )}
    </div>
  );
}
