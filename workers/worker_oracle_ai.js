'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { withConnection, closePool } = require('./lib/oracle-db');

const WATCH_DIR = String(process.env.ORACLE_AI_WATCH_DIR || '/home/ubuntu/controle-financeiro/inbox-pdfs').trim();
const PROCESSED_DIR = String(process.env.ORACLE_AI_PROCESSED_DIR || path.join(WATCH_DIR, 'processed')).trim();
const FAILED_DIR = String(process.env.ORACLE_AI_FAILED_DIR || path.join(WATCH_DIR, 'failed')).trim();
const LOOP_SECONDS = Math.max(5, Number(process.env.ORACLE_AI_WATCH_INTERVAL_SECONDS || 20));
const OCI_BIN = String(process.env.ORACLE_AI_OCI_BIN || process.env.OCI_CLI_BIN || 'oci').trim();
const OCI_REGION = String(process.env.ORACLE_AI_REGION || process.env.OCI_REGION || 'sa-saopaulo-1').trim();
const TENANT_USER_ID = String(process.env.ORACLE_AI_TENANT_USER_ID || 'guilherme').trim();

let timer = null;
let running = false;

function ensureDirs() {
  fs.mkdirSync(WATCH_DIR, { recursive: true });
  fs.mkdirSync(PROCESSED_DIR, { recursive: true });
  fs.mkdirSync(FAILED_DIR, { recursive: true });
}

function fileHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function walkText(node, out) {
  if (node == null) return;
  if (typeof node === 'string') {
    const t = node.trim();
    if (t) out.push(t);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach(entry => walkText(entry, out));
    return;
  }
  if (typeof node === 'object') {
    Object.values(node).forEach(value => walkText(value, out));
  }
}

function extractText(payload) {
  const bucket = [];
  walkText(payload, bucket);
  return Array.from(new Set(bucket)).slice(0, 5000).join('\n');
}

function callOciDocument(pdfBuffer) {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'oracle-ai-worker-'));
  const inputPath = path.join(tmpDir, 'doc.pdf');
  const outputPath = path.join(tmpDir, 'result.json');
  fs.writeFileSync(inputPath, pdfBuffer);
  try {
    const args = [
      'ai-document',
      'analyze-document',
      '--features',
      '["TEXT_DETECTION"]',
      '--file',
      inputPath,
      '--output',
      'json',
      '--region',
      OCI_REGION
    ];
    const output = execFileSync(OCI_BIN, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 30 * 1024 * 1024
    });
    fs.writeFileSync(outputPath, output, 'utf8');
    return JSON.parse(output);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function upsertDocumentRow({
  fileName,
  filePath,
  hash,
  status,
  documentType = 'INVOICE',
  extractedText = '',
  extractedFields = {},
  rawResult = {},
  errorMessage = ''
}) {
  await withConnection(async conn => {
    const sql = `
MERGE INTO documentos_oracle_ai d
USING (
  SELECT :tenant_user_id AS tenant_user_id, :source_file_hash AS source_file_hash FROM dual
) src
ON (
  d.tenant_user_id = src.tenant_user_id
  AND d.source_file_hash = src.source_file_hash
)
WHEN MATCHED THEN UPDATE SET
  d.source_file_name = :source_file_name,
  d.source_file_path = :source_file_path,
  d.processing_status = :processing_status,
  d.document_type = :document_type,
  d.extracted_text = :extracted_text,
  d.extracted_fields_json = :extracted_fields_json,
  d.raw_result_json = :raw_result_json,
  d.error_message = :error_message,
  d.processed_at = CASE WHEN :processing_status = 'PROCESSED' THEN SYSTIMESTAMP ELSE d.processed_at END,
  d.updated_at = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT (
  tenant_user_id,
  source_file_name,
  source_file_path,
  source_file_hash,
  processing_status,
  document_type,
  extracted_text,
  extracted_fields_json,
  raw_result_json,
  error_message,
  source_system,
  created_at,
  processed_at,
  updated_at
) VALUES (
  :tenant_user_id,
  :source_file_name,
  :source_file_path,
  :source_file_hash,
  :processing_status,
  :document_type,
  :extracted_text,
  :extracted_fields_json,
  :raw_result_json,
  :error_message,
  'ORACLE_AI',
  SYSTIMESTAMP,
  CASE WHEN :processing_status = 'PROCESSED' THEN SYSTIMESTAMP ELSE NULL END,
  SYSTIMESTAMP
)`;

    const binds = {
      tenant_user_id: TENANT_USER_ID,
      source_file_name: fileName,
      source_file_path: filePath,
      source_file_hash: hash,
      processing_status: status,
      document_type: documentType,
      extracted_text: extractedText,
      extracted_fields_json: JSON.stringify(extractedFields || {}),
      raw_result_json: JSON.stringify(rawResult || {}),
      error_message: errorMessage.slice(0, 2000)
    };
    await conn.execute(sql, binds, { autoCommit: true });
  });
}

function moveFile(fromPath, toDir) {
  const targetPath = path.join(toDir, path.basename(fromPath));
  fs.renameSync(fromPath, targetPath);
  return targetPath;
}

async function processFile(filePath) {
  const fileName = path.basename(filePath);
  const buffer = fs.readFileSync(filePath);
  const hash = fileHash(buffer);
  try {
    await upsertDocumentRow({
      fileName,
      filePath,
      hash,
      status: 'PROCESSING',
      extractedFields: {},
      rawResult: {}
    });
    const ociResult = callOciDocument(buffer);
    const extractedText = extractText(ociResult);
    await upsertDocumentRow({
      fileName,
      filePath,
      hash,
      status: 'PROCESSED',
      extractedText,
      extractedFields: {},
      rawResult: ociResult
    });
    const moved = moveFile(filePath, PROCESSED_DIR);
    console.log(`[process-pdf-ai] OK ${fileName} -> ${moved}`);
  } catch (error) {
    await upsertDocumentRow({
      fileName,
      filePath,
      hash,
      status: 'ERROR',
      extractedFields: {},
      rawResult: {},
      errorMessage: String(error?.message || error)
    }).catch(() => {});
    const moved = moveFile(filePath, FAILED_DIR);
    console.error(`[process-pdf-ai] ERRO ${fileName} -> ${moved}: ${error?.message || error}`);
  }
}

async function scanOnce() {
  if (running) return;
  running = true;
  try {
    ensureDirs();
    const entries = fs.readdirSync(WATCH_DIR, { withFileTypes: true });
    const pdfFiles = entries
      .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf'))
      .map(entry => path.join(WATCH_DIR, entry.name));
    for (const filePath of pdfFiles) {
      // eslint-disable-next-line no-await-in-loop
      await processFile(filePath);
    }
  } finally {
    running = false;
  }
}

function scheduleNext() {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    await scanOnce();
    scheduleNext();
  }, LOOP_SECONDS * 1000);
}

async function start() {
  console.log(`[process-pdf-ai] iniciando. watchDir=${WATCH_DIR} interval=${LOOP_SECONDS}s region=${OCI_REGION}`);
  ensureDirs();
  await scanOnce();
  scheduleNext();
}

async function shutdown(signal) {
  console.log(`[process-pdf-ai] encerrando (${signal})...`);
  clearTimeout(timer);
  await closePool().catch(() => {});
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch(error => {
  console.error('[process-pdf-ai] falha fatal ao iniciar:', error?.message || error);
  process.exit(1);
});

