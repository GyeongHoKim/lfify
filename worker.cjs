'use strict';
const { workerData, parentPort } = require('worker_threads');
const { processFile } = require('./index.cjs');

(async () => {
  try {
    await processFile(workerData.filePath);
    parentPort.postMessage({ ok: true });
  } catch (err) {
    parentPort.postMessage({ ok: false, error: err.message });
  }
})();
