import { useState } from 'react';

export function useCursorPagination<T extends string | number>(scope: string) {
  const [state, setState] = useState<{ scope: string; cursors: (T | undefined)[] }>({
    scope,
    cursors: [undefined],
  });
  const cursors = state.scope === scope ? state.cursors : [undefined];
  if (state.scope !== scope) setState({ scope, cursors });

  return {
    cursor: cursors.at(-1),
    page: cursors.length,
    previous: () =>
      setState({ scope, cursors: cursors.length > 1 ? cursors.slice(0, -1) : cursors }),
    next: (cursor: T) => setState({ scope, cursors: [...cursors, cursor] }),
  };
}
