function positiveLimit(value, fallback) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 && number <= 2147483647 ? number : fallback;
}

async function fetchText(url, options = {}, timeoutMs = 45000) {
  const controller = new AbortController();
  const upstream = options.signal;
  const abort = () => controller.abort(upstream.reason);
  if (upstream?.aborted) abort();
  else upstream?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(new Error('Integration request timed out')),
    positiveLimit(timeoutMs, 45000));
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return { response, text: await response.text() };
  } finally {
    clearTimeout(timer);
    upstream?.removeEventListener('abort', abort);
  }
}

module.exports = { fetchText, positiveLimit };
