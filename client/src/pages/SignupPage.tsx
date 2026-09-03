import { useState, type FormEvent } from 'react';
import { Header } from '@/shared/components/layout';
import { Button, Input } from '@/shared/components/ui';
import {
  EMPTY_SIGNUP,
  SIGNUP_FIELDS,
  SsafyLoginButton,
  isSignupValid,
  useSignup,
  validateSignup,
  type SignupErrors,
  type SignupForm,
} from '@/features/auth';

/**
 * 회원가입.
 *
 * 입력 항목·검증 규칙은 전부 `signup.model.ts` 의 테이블에 있습니다.
 * 이 화면은 그걸 그리기만 하므로, 항목을 추가하려면 모델에 한 줄만 넣으면 됩니다.
 *
 * 에러는 **한 번 건드린 항목부터** 보여줍니다. 타이핑 첫 글자에 빨간 글씨가 뜨면
 * 아직 다 쓰지도 않았는데 혼나는 느낌이 듭니다.
 */
export function SignupPage() {
  const [form, setForm] = useState<SignupForm>(EMPTY_SIGNUP);
  const [touched, setTouched] = useState<Partial<Record<keyof SignupForm, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const signup = useSignup();

  const errors: SignupErrors = validateSignup(form);
  const valid = isSignupValid(form);

  const visibleError = (name: keyof SignupForm) =>
    submitted || touched[name] ? (errors[name] ?? null) : null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!valid) return;

    const { passwordConfirm: _ignored, ...body } = form;
    signup.mutate(body);
  };

  return (
    <>
      <Header title="회원가입" showBack />

      <div className="space-y-3 p-4 pt-6">
        <SsafyLoginButton />
        <div className="flex items-center gap-3">
          <span className="bg-line h-px flex-1" />
          <span className="text-subtle text-xs">또는 직접 입력</span>
          <span className="bg-line h-px flex-1" />
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 p-4 pt-0">
        <p className="text-subtle text-xs">
          <span className="text-danger">*</span> 표시는 필수 항목입니다.
        </p>

        {SIGNUP_FIELDS.map((field) => (
          <Input
            key={field.name}
            label={field.label}
            showRequirement
            required={field.required}
            type={field.type}
            value={form[field.name]}
            placeholder={field.placeholder}
            hint={field.hint}
            autoComplete={field.autoComplete}
            inputMode={field.inputMode}
            maxLength={field.maxLength}
            error={visibleError(field.name)}
            onChange={(e) => {
              const next = field.format ? field.format(e.target.value) : e.target.value;
              setForm((prev) => ({ ...prev, [field.name]: next }));
            }}
            onBlur={() => setTouched((prev) => ({ ...prev, [field.name]: true }))}
          />
        ))}

        <Button
          type="submit"
          variant="dark"
          size="lg"
          fullWidth
          className="mt-2"
          loading={signup.isPending}
          disabled={!valid}
        >
          가입하기
        </Button>
      </form>
    </>
  );
}
