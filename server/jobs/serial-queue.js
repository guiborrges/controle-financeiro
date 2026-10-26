class QueueCapacityError extends Error {
  constructor() { super('Integration queue capacity reached'); this.code = 'INTEGRATION_BUSY'; }
}

function createSerialQueue({ retryFailure = false, maxPendingPerKey = Infinity, maxPending = Infinity } = {}) {
  const queues = new Map();
  const pending = new Map();
  const jobs = new Map();
  let total = 0;
  function assertCapacity(key) {
    if ((pending.get(key) || 0) >= maxPendingPerKey || total >= maxPending) throw new QueueCapacityError();
  }
  return {
    assertCapacity,
    hasJob: (key, jobId) => jobs.get(key)?.has(jobId) || false,
    pending: key => key === undefined ? total : pending.get(key) || 0,
    enqueue(key, run, { jobId } = {}) {
      if (jobId && jobs.get(key)?.has(jobId)) return jobs.get(key).get(jobId);
      assertCapacity(key);
      total++;
      pending.set(key, (pending.get(key) || 0) + 1);
      const previous = queues.get(key) || Promise.resolve();
      const next = retryFailure ? previous.then(run).catch(run) : previous.then(run, run);
      const tracked = next.finally(() => {
        total--;
        const remaining = pending.get(key) - 1;
        if (remaining) pending.set(key, remaining); else pending.delete(key);
        if (jobId) {
          jobs.get(key)?.delete(jobId);
          if (!jobs.get(key)?.size) jobs.delete(key);
        }
        if (queues.get(key) === tail) queues.delete(key);
      });
      const tail = tracked.catch(() => {});
      queues.set(key, tail);
      if (jobId) {
        if (!jobs.has(key)) jobs.set(key, new Map());
        jobs.get(key).set(jobId, tracked);
      }
      return tracked;
    }
  };
}

module.exports = { createSerialQueue, QueueCapacityError };
