import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'legacy-angular', 'supabase', 'graphify-out']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    // Compensa las opciones de tsconfig desactivadas para poder copiar src/domain sin cambios
    // (verbatimModuleSyntax, erasableSyntaxOnly y noUnusedLocals en clases): se exigen fuera del dominio.
    files: ['**/*.{ts,tsx}'],
    ignores: ['src/domain/**'],
    rules: {
      // Cubre también los miembros `private` de TypeScript (la regla base solo cubre `#private`);
      // equivale a lo que noUnusedLocals detectaría en clases, sin activarlo para src/domain.
      '@typescript-eslint/no-unused-private-class-members': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSParameterProperty',
          message: 'Declare la propiedad y asígnela en el constructor (sin parameter properties).',
        },
        { selector: 'TSEnumDeclaration', message: 'Use una unión de literales o un objeto as const.' },
      ],
    },
  },
  {
    // Solo infrastructure habla con la red (HttpClient/adaptadores). check:architecture cubre además
    // `globalThis|window|self.fetch`; esta regla da el aviso en el editor.
    files: [
      'src/domain/**/*.{ts,tsx}',
      'src/application/**/*.{ts,tsx}',
      'src/presentation/**/*.{ts,tsx}',
      'src/main.tsx',
    ],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message:
            'fetch solo se usa en src/infrastructure. Use un puerto de application (y un hook con TanStack Query en presentation).',
        },
      ],
    },
  },
  {
    // Código generado por Shadcn (`shadcn add`): no se edita salvo theming. Exporta variantes junto al
    // componente y algunos hooks (p. ej. use-mobile) sincronizan estado en efectos.
    files: ['src/shared/ui/**/*.{ts,tsx}', 'src/shared/hooks/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['scripts/**/*.mjs', 'eslint.config.js'],
    extends: [js.configs.recommended],
    languageOptions: { ecmaVersion: 2023, globals: globals.node },
  },
  {
    files: ['vite.config.ts', 'vitest.config.ts'],
    languageOptions: { globals: globals.node },
  },
])
