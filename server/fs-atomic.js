const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function buildTempFilePath(filePath) {
  const stamp = `${Date.now()}_${process.pid}_${crypto.randomBytes(4).toString('hex')}`;
  return `${filePath}.${stamp}.tmp`;
}

function renameReplaceSafe(tempPath, targetPath) {
  // Fail closed on Windows locks: never delete the last committed target.
  fs.renameSync(tempPath, targetPath);
}

function writeTextFileAtomic(filePath, content, encoding = 'utf8') {
  ensureParentDir(filePath);
  const tempPath = buildTempFilePath(filePath);
  try {
    const fileDescriptor = fs.openSync(tempPath, 'w');
    try {
      fs.writeFileSync(fileDescriptor, Buffer.from(String(content), encoding));
      fs.fsyncSync(fileDescriptor);
    } finally {
      fs.closeSync(fileDescriptor);
    }
    renameReplaceSafe(tempPath, filePath);
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
}

function writeJsonFileAtomic(filePath, payload) {
  const text = `${JSON.stringify(payload, null, 2)}\n`;
  writeTextFileAtomic(filePath, text, 'utf8');
}

module.exports = {
  writeTextFileAtomic,
  writeJsonFileAtomic
};
