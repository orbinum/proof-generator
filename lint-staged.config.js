module.exports = {
  '*.ts': ['prettier --write'],
  '*.{json,md}': ['prettier --write'],
  // Run full project lint after all formatters complete
  '*': () => 'npm run lint'
};
