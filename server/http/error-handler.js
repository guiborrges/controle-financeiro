const crypto = require('crypto');

function createErrorHandler({ logger = console, randomUUID = crypto.randomUUID } = {}) {
  return function handleError(error, req, res, next) {
    const requestId = randomUUID();
    const safeMessage = String(error?.message || 'Erro interno').slice(0, 300);
    const safePath = String(req?.path || '');
    logger.error(`[error:${requestId}] ${safePath} ${safeMessage}`);
    if (res.headersSent) return next(error);
    if (req.path.startsWith('/api/')) {
      if (error?.type === 'entity.too.large' || error?.status === 413) {
        return res.status(413).json({ message: 'Os dados enviados s\u00e3o grandes demais para o servidor.' });
      }
      return res.status(500).json({ message: 'Erro interno no servidor.', requestId });
    }
    return res.status(500).send(`Erro interno no servidor. Ref: ${requestId}`);
  };
}

module.exports = { createErrorHandler };
