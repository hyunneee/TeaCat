import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/shared/components/layout';
import { Loading } from '@/shared/components/common';
import { Button, Card, Input } from '@/shared/components/ui';
import { ROUTES } from '@/shared/constants';
import { toast } from '@/shared/stores';
import {
  EMPTY_OAUTH_SIGNUP,
  OAUTH_SIGNUP_FIELDS,
  isOauthSignupValid,
  usePendingOauthSignup,
  useOauthSignup,
  validateOauthSignup,
  type OauthSignupForm,
} from '@/features/auth';

/**
 * SSAFY 인증은 끝났지만 가입이 안 끝난 사람이 남은 정보를 채우는 화면.
 *
 * 이메일은 SSAFY 가 알려준 값을 쓰므로 보여주기만 하고 입력받지 않습니다
 * (사용자가 바꿔 보낼 수 있으면 인증의 의미가 없습니다).
 */
export function OauthSignupPage() {
  const navigate = useNavigate();
  const pending = usePendingOauthSignup();
  const signup = useOauthSignup();

  const [form, setForm] = useState<OauthSignupForm>(EMPTY_OAUTH_SIGNUP);
  const [submitted, setSubmitted] = useState(false);

  // SSAFY 가 이름을 줬으면 미리 채웁니다
  useEffect(() => {
    const name = pending.data?.name;
    if (name) setForm((prev) => (prev.name ? prev : { ...prev, name }));
  }, [pending.data]);

  // 가입 티켓이 만료됐으면 처음부터 다시 해야 합니다
  useEffect(() => {
    if (!pending.isError) return;
    toast.error('가입 시간이 지났어요. 다시 시도해 주세요.');
    navigate(ROUTES.LOGIN, { replace: true });
  }, [pending.isError, navigate]);

  const errors = validateOauthSignup(form);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!isOauthSignupValid(form)) return;
    signup.mutate(form);
  };

  if (pending.isPending) return <Loading label="SSAFY 계정을 확인하고 있어요" />;

  return (
    <>
      <Header title="가입 마무리" />

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 p-4 pt-6">
        <Card className="text-subtle text-sm">
          SSAFY 계정 <span className="font-bold">{pending.data?.email}</span> 으로 가입합니다. 티켓
          발급에 필요한 정보만 더 받을게요.
        </Card>

        {OAUTH_SIGNUP_FIELDS.map((field) => {
          const key = field.name as keyof OauthSignupForm;

          return (
            <Input
              key={field.name}
              label={field.label}
              showRequirement
              required={field.required}
              type={field.type}
              value={form[key]}
              placeholder={field.placeholder}
              hint={field.hint}
              autoComplete={field.autoComplete}
              inputMode={field.inputMode}
              maxLength={field.maxLength}
              error={submitted ? (errors[key] ?? null) : null}
              onChange={(e) => {
                const next = field.format ? field.format(e.target.value) : e.target.value;
                setForm((prev) => ({ ...prev, [key]: next }));
              }}
            />
          );
        })}

        <Button
          type="submit"
          variant="dark"
          size="lg"
          fullWidth
          className="mt-2"
          loading={signup.isPending}
        >
          가입 완료
        </Button>
      </form>
    </>
  );
}
