// Input không bị password manager (LastPass / 1Password / Bitwarden / iCloud / Chrome)
// detect là credential field. Per memory rule: feedback_no_autofill_inputs.md

import { forwardRef, useId, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'name'> & {
  type?: 'text' | 'tel' | 'url' | 'search';
  name?: string;
};

export const NoFillInput = forwardRef<HTMLInputElement, Props>(function NoFillInput(
  { type = 'text', name, ...rest },
  ref,
) {
  const auto = useId();
  const finalName = name ?? `f-${auto.replace(/[:]/g, '')}`;
  return (
    <input
      ref={ref}
      type={type}
      name={finalName}
      autoComplete="new-password"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      data-1p-ignore="true"
      data-lpignore="true"
      data-lastpass-ignore="true"
      data-bwignore="true"
      data-form-type="other"
      role="textbox"
      {...rest}
    />
  );
});
