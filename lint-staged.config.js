module.exports = {
  // Format and lint-fix staged TypeScript files
  'src/**/*.{ts,tsx}': ['prettier --write', 'eslint --fix'],
  // Full type-check on any TS/TSX change — function ignores file list so tsc
  // always sees the whole project and catches cross-file type errors
  '**/*.{ts,tsx}': () => 'tsc --noEmit',
};
