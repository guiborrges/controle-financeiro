const childProcess = require('node:child_process');
const { positiveLimit } = require('./deadline');

function runFile(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    childProcess.execFile(file, args, { killSignal: 'SIGKILL', ...options, timeout: positiveLimit(options.timeout, 120000) },
      (error, stdout, stderr) => {
        if (error) {
          error.stdout = stdout;
          error.stderr = stderr;
          reject(error);
        } else resolve(stdout);
      });
  });
}

module.exports = { runFile };
