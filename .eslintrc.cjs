module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  // functions/ has its own Google-style config (linted via its predeploy hook);
  // video/build is generated webpack output.
  ignorePatterns: ['dist', 'dev-dist', 'functions', 'video', '.eslintrc.cjs'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    'react/prop-types': 'off',
  },
  overrides: [
    {
      // Node context: vite config reads process.env
      files: ['vite.config.js'],
      env: { node: true },
    },
    {
      // Clean-code caps, scoped to app code. Build-blocking: the lint script
      // runs with --max-warnings 0.
      files: ['src/**/*.{js,jsx}'],
      rules: {
        complexity: ['error', 10], // cyclomatic complexity ≤ 10
        'max-statements': ['error', 30], // statements per function ≤ 30
        'max-params': ['error', 5], // arguments per function ≤ 5
        'max-depth': ['error', 4], // nested blocks ≤ 4
        'max-nested-callbacks': ['error', 4], // callback nesting ≤ 4
        // React Query v5: the positional form `invalidateQueries(['key'])`
        // doesn't throw — the array destructures to an empty filter and
        // silently invalidates EVERY cached query (see PR #20).
        'no-restricted-syntax': [
          'error',
          {
            selector:
              "CallExpression[callee.property.name=/^(invalidateQueries|refetchQueries|removeQueries|resetQueries|cancelQueries)$/] > ArrayExpression:first-child",
            message:
              "React Query v5 requires the object filter form: use { queryKey: [...] } — a positional array silently matches ALL queries.",
          },
        ],
      },
    },
  ],
}
