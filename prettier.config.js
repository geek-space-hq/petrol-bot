/** @type {import('prettier').Options} */

module.exports = {
  printWidth: 120,
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  overrides: [
    {
      files: '*.{md}',
      options: {
        printWidth: 80,
        singleQuote: false,
        trailingComma: 'none',
      },
    },
  ],
};
