import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'node_modules'] },

  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended, prettier],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // 타입 import 는 `import type` 으로 강제 (verbatimModuleSyntax 와 짝)
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],

      // ── 아키텍처 경계 강제 ──────────────────────────────────
      // feature 의 내부 구현을 밖에서 직접 파고들지 못하게 막는다.
      // 반드시 `@/features/<name>` (= index.ts 배럴) 로만 import 할 것.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*/*'],
              message:
                'feature 내부를 직접 import 하지 마세요. `@/features/<이름>` 배럴(index.ts)에서 가져오세요. 필요한 게 배럴에 없다면 그 feature 담당자와 상의해 export 를 추가하세요.',
            },
            {
              group: ['../../*'],
              message: '2단계 이상 상위 경로는 `@/` 별칭을 쓰세요.',
            },
            {
              group: ['@/mocks', '@/mocks/**'],
              message:
                '목업은 main.tsx 의 부트스트랩에서만 로드합니다. 화면/훅/api 가 목업의 존재를 알면 나중에 폴더를 지울 수 없습니다.',
            },
          ],
        },
      ],
    },
  },

  // 부트스트랩과 목업 폴더 자신은 예외
  {
    files: ['src/main.tsx', 'src/mocks/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': 'off' },
  },

  // shared 는 도메인을 몰라야 한다. (역방향 의존 금지)
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/**', '@/pages/**', '@/app/**'],
              message:
                'shared 는 특정 도메인에 의존할 수 없습니다. 도메인 지식이 필요하면 그 코드는 features 로 옮기세요.',
            },
          ],
        },
      ],
    },
  },

  // feature 는 자기 자신 내부는 상대경로로 자유롭게 접근 가능
  {
    files: ['src/features/*/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/pages/**'],
              message: 'feature 가 page 를 알면 안 됩니다. 의존 방향은 pages → features 입니다.',
            },
          ],
        },
      ],
    },
  },
);
