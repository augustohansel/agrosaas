import styles from './styles.module.css';

interface Option {
  value: string | number;
  label: string;
}

interface CustomSelectProps {
  id?: string;
  ariaLabel?: string;
  value: string | number;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
}

export function CustomSelect({ id, ariaLabel, value, onChange, options, placeholder = "Selecione..." }: CustomSelectProps) {
  const hasSelection = options.some(option => String(option.value) === String(value));

  return (
    <select id={id} aria-label={ariaLabel} className={styles.field} value={value}
      onChange={event => onChange(event.currentTarget.value)}>
      {!hasSelection && <option value={value} disabled hidden>{placeholder}</option>}
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}
