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
      // Clean-code caps, scoped to app code. Currently "warn" with a
      // --max-warnings ratchet in package.json while pre-existing violations
      // are worked down (docs/backlog/todo.lint-ratchet.md); flip to "error"
      // + --max-warnings 0 when the count hits zero.
      files: ['src/**/*.{js,jsx}'],
      rules: {
        complexity: ['warn', 10], // cyclomatic complexity ≤ 10
        'max-statements': ['warn', 30], // statements per function ≤ 30
        'max-params': ['warn', 5], // arguments per function ≤ 5
        'max-depth': ['warn', 4], // nested blocks ≤ 4
        'max-nested-callbacks': ['warn', 4], // callback nesting ≤ 4
      },
    },
  ],
}
