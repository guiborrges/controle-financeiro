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
  try {
    fs.renameSync(tempPath, targetPath);
    return;
  } catch (error) {
    if (!error || !['EEXIST', 'EPERM', 'ENOTEMPTY'].includes(error.code)) {
      throw error;
    }
  }
  try {
    fs.rmSync(targetPath, { force: true });
  } catch {}
  fs.renameSync(tempPath, targetPath);
}

function writeTextFileAtomic(filePath, content, encoding = 'utf8') {
  ensureParentDir(filePath);
  const tempPath = buildTempFilePath(filePath);
  const fileDescriptor = fs.openSync(tempPath, 'w');
  try {
    const buffer = Buffer.from(String(content), encoding);
    fs.writeSync(fileDescriptor, buffer, 0, buffer.length, 0);
    fs.fsyncSync(fileDescriptor);
  } finally {
    fs.closeSync(fileDescriptor);
  }
  renameReplaceSafe(tempPath, filePath);
}

function writeJsonFileAtomic(filePath, payload) {
  const text = `${JSON.stringify(payload, null, 2)}\n`;
  writeTextFileAtomic(filePath, text, 'utf8');
}

module.exports = {
  writeTextFileAtomic,
  writeJsonFileAtomic
};
