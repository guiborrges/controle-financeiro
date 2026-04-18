(function initSharedFormatters(global) {
  function fmt(n) {
    const value = Number(n) || 0;
    return `R$ ${Math.abs(value).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  function fmtSigned(n) {
    const value = Number(n) || 0;
    return `${value < 0 ? '- ' : '+ '}${fmt(value)}`;
  }

  global.fmt = fmt;
  global.fmtSigned = fmtSigned;
})(window);
