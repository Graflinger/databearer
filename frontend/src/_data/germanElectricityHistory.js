const { readHistory } = require('../data_ingestion/builders/electricityHistory');

// Reread all history files and verify their overlap with the raw recent snapshot
// on every build/watch evaluation, before rendering any history summary.
module.exports = () => readHistory();
