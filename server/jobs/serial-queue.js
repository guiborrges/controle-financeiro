function createSerialQueue({ retryFailure = false } = {}) {
  const queues = new Map();
  return {
    enqueue(key, run) {
      const previous = queues.get(key) || Promise.resolve();
      const next = retryFailure ? previous.then(run).catch(run) : previous.then(run, run);
      queues.set(key, next.catch(() => {}));
      return next;
    }
  };
}

module.exports = { createSerialQueue };
