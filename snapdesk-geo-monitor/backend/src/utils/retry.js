// utils/retry.js
// Réessaie un appel API en cas d'erreur temporaire (429 = quota/rate limit
// dépassé, 5xx = erreur serveur, erreurs réseau) avec un backoff exponentiel.
// Les autres erreurs (401, 400, etc.) ne sont pas retryées : ce sont des
// erreurs de configuration qui ne se résoudront pas en réessayant.

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(err) {
  const status = err.status ?? err.statusCode;
  if (status === 429 || (status >= 500 && status < 600)) return true;
  if (["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"].includes(err.code)) {
    return true;
  }
  return false;
}

export async function withRetry(fn, { retries = 3, baseDelayMs = 1000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !isRetryable(err)) throw err;
      const delay = baseDelayMs * 2 ** attempt + Math.random() * 250;
      console.warn(
        `  ... erreur temporaire (${err.status ?? err.code ?? err.message}), nouvelle tentative dans ${Math.round(delay)}ms (${attempt + 1}/${retries})`
      );
      await sleep(delay);
    }
  }
  throw lastErr;
}
