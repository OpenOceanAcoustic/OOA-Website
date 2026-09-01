import type { ChangeEvent, ReactNode } from "react";

export interface NumberFieldProps {
  readonly id: string;
  readonly label: ReactNode;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly unit?: string;
  readonly ariaLabel?: string;
  readonly className?: string;
  readonly inputClassName?: string;
  readonly disabled?: boolean;
  onValueChange(value: number): void;
}

export function NumberField({
  id,
  label,
  value,
  min,
  max,
  step,
  unit,
  ariaLabel,
  className,
  inputClassName,
  disabled = false,
  onValueChange,
}: NumberFieldProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => onValueChange(event.currentTarget.valueAsNumber);
  return (
    <label className={className} htmlFor={id}>
      {label}
      <input
        id={id}
        className={inputClassName}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        aria-label={ariaLabel}
        disabled={disabled}
        onChange={handleChange}
      />
      {unit === undefined ? null : <span aria-hidden="true">{unit}</span>}
    </label>
  );
}

export interface SelectOption {
  readonly value: string;
  readonly label: ReactNode;
}

export interface SelectFieldProps {
  readonly id: string;
  readonly label: ReactNode;
  readonly value: string;
  readonly options: readonly SelectOption[];
  readonly className?: string;
  readonly selectClassName?: string;
  readonly disabled?: boolean;
  onValueChange(value: string): void;
}

export function SelectField({
  id,
  label,
  value,
  options,
  className,
  selectClassName,
  disabled = false,
  onValueChange,
}: SelectFieldProps) {
  return (
    <label className={className} htmlFor={id}>
      {label}
      <select
        id={id}
        className={selectClassName}
        value={value}
        disabled={disabled}
        onChange={(event) => onValueChange(event.currentTarget.value)}
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

export interface RangeFieldProps extends NumberFieldProps {
  readonly output: string;
  readonly startLabel?: string;
  readonly endLabel?: string;
  readonly titleClassName?: string;
  readonly endsClassName?: string;
}

export function RangeField({
  id,
  label,
  value,
  min,
  max,
  step,
  output,
  startLabel,
  endLabel,
  ariaLabel,
  className,
  inputClassName,
  titleClassName,
  endsClassName,
  disabled = false,
  onValueChange,
}: RangeFieldProps) {
  return (
    <div className={className}>
      <div className={titleClassName}>
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{output}</output>
      </div>
      <input
        id={id}
        className={inputClassName}
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        aria-label={ariaLabel}
        disabled={disabled}
        onChange={(event) => onValueChange(event.currentTarget.valueAsNumber)}
      />
      {startLabel === undefined && endLabel === undefined ? null : (
        <div className={endsClassName}><span>{startLabel}</span><span>{endLabel}</span></div>
      )}
    </div>
  );
}
