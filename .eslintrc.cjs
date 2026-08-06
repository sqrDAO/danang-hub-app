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
      // Node context: the test suite runs under `node --test` and sets
      // process.env.TZ to prove hub-timezone helpers ignore the local zone.
      files: ['test/**/*.js'],
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
        // React Query v5: anything but a literal object filter silently widens
        // the match. `invalidateQueries(['key'])` destructures the array to an
        // empty filter (see PR #20) and `invalidateQueries()` has no filter at
        // all — both invalidate EVERY cached query. Requiring the first
        // argument to be an ObjectExpression rejects those, plus the variable
        // form `invalidateQueries(filter)`, which is unreviewable at the call
        // site. Build a filter object inline, or pass it through the
        // useInvalidateQueries hook.
        'no-restricted-syntax': [
          'error',
          {
            selector:
              "CallExpression[callee.property.name=/^(invalidateQueries|refetchQueries|removeQueries|resetQueries|cancelQueries)$/]:not([arguments.0.type='ObjectExpression'])",
            message:
              "React Query v5 requires a literal object filter: use { queryKey: [...] }. A positional array, a variable, or no argument at all silently matches ALL queries.",
          },
        ],
      },
    },
  ],
}
