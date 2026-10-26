import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './styles.module.css';

interface Option {
  value: string | number;
  label: string;
}

interface CustomSelectProps {
  value: string | number;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
}

export function CustomSelect({ value, onChange, options, placeholder = "Selecione..." }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Encontra o texto da opção selecionada atualmente
  const selectedOption = options.find(opt => opt.value === value);

  // Fecha o dropdown se clicar fora dele
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <button 
        type="button" 
        className={`${styles.trigger} ${isOpen ? styles.triggerFocus : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown size={16} className={`${styles.triggerIcon} ${isOpen ? styles.triggerIconOpen : ''}`} />
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          {options.map((option) => (
            <div
              key={option.value}
              className={`${styles.option} ${value === option.value ? styles.optionSelected : ''}`}
              onClick={() => handleSelect(String(option.value))}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}