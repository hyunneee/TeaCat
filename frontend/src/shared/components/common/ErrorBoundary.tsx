import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, CatMascot } from '@/shared/components/ui';
import { env } from '@/shared/config';

interface Props {
  children: ReactNode;
  /** 에러 상황에 보여줄 화면. 없으면 기본 화면. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** 이 값이 바뀌면 에러 상태를 자동으로 리셋합니다 (라우트 이동 시). */
  resetKey?: unknown;
}

interface State {
  error: Error | null;
}

/**
 * 렌더링 중 터진 에러를 잡아 흰 화면 대신 안내 UI 를 보여줍니다.
 * (이벤트 핸들러/비동기 에러는 못 잡습니다 — 그건 TanStack Query 나 try-catch 담당)
 *
 * 개발 모드에서는 에러 이름·메시지·컴포넌트 스택 첫 줄을 화면에 노출합니다.
 * 팀원이 "문제가 발생했어요"만 보고 제보하면 원인을 찾을 수 없기 때문입니다.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  private componentStack: string | null = null;

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    // 라우트가 바뀌면 에러를 털어냅니다.
    // 이게 없으면 한 번 터진 뒤 다른 메뉴를 눌러도 계속 에러 화면에 갇힙니다.
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.componentStack = null;
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.componentStack = info.componentStack ?? null;
    // TODO: Sentry 등 에러 리포팅 붙일 자리
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private reset = () => {
    this.componentStack = null;
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    const firstFrame = this.componentStack?.trim().split('\n')[0]?.trim();

    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-6 text-center">
        <CatMascot mood="sad" size={84} />

        <div className="space-y-1">
          <p className="font-bold">문제가 발생했어요</p>
          <p className="text-muted text-sm">잠시 후 다시 시도해 주세요.</p>
        </div>

        {/* 개발 중에는 원인을 그대로 보여줍니다. 운영 번들에서는 빠집니다. */}
        {env.isDev && (
          <pre className="surface-sunken border-line text-danger max-w-full overflow-x-auto rounded-lg border p-3 text-left text-[0.6875rem] leading-relaxed">
            {error.name}: {error.message}
            {firstFrame ? `\n${firstFrame}` : ''}
          </pre>
        )}

        <div className="flex gap-2">
          <Button variant="secondary" onClick={this.reset}>
            다시 시도
          </Button>
          <Button variant="ghost" onClick={() => window.location.assign('/')}>
            홈으로
          </Button>
        </div>
      </div>
    );
  }
}
