'use client';
// PickField — ô chọn MỘT có tìm kiếm (kiểu select2), nằm trong FormField như <SelectField>.
// Thay cho <select> thường ở mọi form: ba lựa chọn hay ba nghìn thì thao tác y nhau (gõ để lọc).
// Dựng trên <MultiSelect single> — một popup, một chỗ sửa; đây chỉ là lớp nhãn + giá trị đơn.
import { FormField, type FormFieldProps } from './form-field';
import { MultiSelect, type MultiSelectOption } from './multi-select';

export interface PickFieldProps<T extends string | number> extends Omit<FormFieldProps, 'children'> {
  options: Array<MultiSelectOption<T>>;
  value: T | null | undefined;
  onChange: (v: T | undefined) => void;
  /** chữ trên trigger khi chưa chọn (mặc định '— chọn —') */
  placeholder?: string;
  /** cho phép về rỗng (mặc định: bắt buộc có giá trị) */
  clearable?: boolean;
  popupWidth?: number;
  disabled?: boolean;
  hideSearch?: boolean;
}

export function PickField<T extends string | number>({ options, value, onChange, placeholder = '— chọn —', clearable = false, popupWidth, disabled, hideSearch, ...field }: PickFieldProps<T>) {
  return (
    <FormField {...field}>
      <div data-comp="ui.PickField" style={disabled ? { opacity: 0.6, pointerEvents: 'none' } : undefined}>
        <MultiSelect single fullWidth compact noClear={!clearable} hideSearch={hideSearch} popupWidth={popupWidth}
          label={placeholder} options={options} selected={value == null || value === '' ? [] : [value]}
          onChange={(v) => onChange(v[0])} />
      </div>
    </FormField>
  );
}
