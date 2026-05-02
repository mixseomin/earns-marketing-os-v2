// Input không bị password manager (LastPass / 1Password / Bitwarden / iCloud / Chrome)
// detect là credential field. Dùng cho mọi text input không phải login.
// Per memory rule: feedback_no_autofill_inputs.md
//
// Usage: <NoFillInput value={...} onChange={...} placeholder="..." />
// All native input props pass through.

import type { InputHTMLAttributes } from 'react';
import { useId } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'name'> & {
  /** Optional — defaults to type="text". Never use 'email' or 'password' (triggers PM heuristics). */
  type?: 'text' | 'tel' | 'url' | 'search';
  /** Optional name override; default uses random ID to avoid heuristic match */
  name?: string;
};

export function NoFillInput({ type = 'text', name, ...rest }: Props) {
  // Random unique name avoids PM heuristics matching "email", "username", "handle" etc.
  const auto = useId();
  const finalName = name ?? `f-${auto.replace(/[:]/g, '')}`;
  return (
    <input
      type={type}
      name={finalName}
      autoComplete="new-password"        /* paradox flag — most reliable disable */
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      data-1p-ignore="true"              /* 1Password */
      data-lpignore="true"               /* LastPass classic */
      data-lastpass-ignore="true"        /* LastPass new */
      data-bwignore="true"               /* Bitwarden */
      data-form-type="other"
      role="textbox"
      {...rest}
    />
  );
}
