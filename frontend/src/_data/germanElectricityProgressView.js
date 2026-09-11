// Read and validate the producer's bytes; Eleventy's imported JSON is not trusted.
module.exports = () => require('../data_ingestion/builders/electricityProgress').readProgress();
