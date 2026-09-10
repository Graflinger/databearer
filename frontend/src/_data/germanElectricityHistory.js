const { readHistory } = require('../data_ingestion/builders/electricityHistory');

// Reread all history files and verify their overlap with the raw recent snapshot
// on every build/watch evaluation, before rendering any history summary.
module.exports = () => {
  const { partitions, ...data } = readHistory();
  // Daily rows are only needed by build-time consumers, never embedded in HTML.
  void partitions;
  return data;
};
