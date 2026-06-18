import { useCallback, useRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import './SpellCheckField.css';

type SharedProps = {
  /** Corrige al salir del campo (blur). */
  autoFix?: boolean;
  /** Nombres propios / términos que no deben cambiarse. */
  extraWords?: string[];
};

type TextareaProps = SharedProps &
  TextareaHTMLAttributes<HTMLTextAreaElement> & {
    multiline: true;
  };

type InputProps = SharedProps &
  InputHTMLAttributes<HTMLInputElement> & {
    multiline?: false;
  };

export type SpellCheckFieldProps = TextareaProps | InputProps;

export function SpellCheckField(props: SpellCheckFieldProps) {
  const {
    autoFix = true,
    extraWords = [],
    multiline,
    onBlur,
    className,
  } = props;

  const fixingRef = useRef(false);

  const runFix = useCallback(
    async (el: HTMLTextAreaElement | HTMLInputElement) => {
      if (!autoFix || fixingRef.current) return;
      const value = el.value;
      if (!value.trim()) return;

      const { fixSpanishText } = await import('../utils/spanishSpell');
      const fixed = fixSpanishText(value, extraWords);
      if (fixed === value) return;

      fixingRef.current = true;
      el.value = fixed;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      fixingRef.current = false;
    },
    [autoFix, extraWords],
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      void runFix(e.currentTarget);
      onBlur?.(e as never);
    },
    [onBlur, runFix],
  );

  const common = {
    spellCheck: true,
    lang: 'es',
    autoCorrect: 'on' as const,
    autoCapitalize: 'sentences' as const,
    className: className ? `spellcheck-field ${className}` : 'spellcheck-field',
    onBlur: handleBlur,
  };

  if (multiline) {
    const { multiline: _m, autoFix: _a, extraWords: _e, ...textareaRest } = props as TextareaProps;
    return <textarea {...common} {...textareaRest} />;
  }

  const {
    multiline: _m,
    autoFix: _a,
    extraWords: _e,
    type = 'text',
    ...inputRest
  } = props as InputProps;
  return <input type={type} {...common} {...inputRest} />;
}

/** Textarea con corrección ortográfica en español. */
export function SpellCheckTextarea(
  props: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'lang'> & SharedProps,
) {
  return <SpellCheckField multiline {...props} />;
}

/** Input de texto con corrección ortográfica en español. */
export function SpellCheckInput(
  props: Omit<InputHTMLAttributes<HTMLInputElement>, 'lang'> & SharedProps,
) {
  return <SpellCheckField {...props} />;
}
