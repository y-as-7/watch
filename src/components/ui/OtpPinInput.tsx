'use client';

import React, { useRef } from 'react';

interface OtpPinInputProps {
  length?: number;
  value: string;
  onChange: (val: string) => void;
  onComplete?: (val: string) => void;
}

export default function OtpPinInput({
  length = 6,
  value,
  onChange,
  onComplete,
}: OtpPinInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const digits = Array.from({ length }, (_, i) => value[i] || '');

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    if (!val) {
      const nextDigits = [...digits];
      nextDigits[index] = '';
      const newStr = nextDigits.join('');
      onChange(newStr);
      return;
    }

    const lastChar = val[val.length - 1];
    const nextDigits = [...digits];
    nextDigits[index] = lastChar;
    const newStr = nextDigits.join('');
    onChange(newStr);

    if (index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }

    if (newStr.length === length && onComplete) {
      onComplete(newStr);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (pasted) {
      onChange(pasted);
      const focusIndex = Math.min(pasted.length, length - 1);
      inputsRef.current[focusIndex]?.focus();

      if (pasted.length === length && onComplete) {
        onComplete(pasted);
      }
    }
  };

  return (
    <div className="flex items-center justify-center space-x-1.5 sm:space-x-3 my-4">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digits[i]}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className={`w-10 h-12 sm:w-14 sm:h-16 text-center text-lg sm:text-2xl font-mono font-extrabold rounded-xl sm:rounded-2xl border transition-all duration-200 focus:outline-none ${
            digits[i]
              ? 'bg-purple-950/80 border-purple-500 text-purple-200 shadow-lg shadow-purple-900/40 scale-105'
              : 'bg-slate-900/90 border-slate-700/80 text-white focus:border-purple-400 focus:ring-2 focus:ring-purple-500/50'
          }`}
        />
      ))}
    </div>
  );
}
