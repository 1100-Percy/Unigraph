import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function summarize(label, value) {
  const type = typeof value;
  const isFunction = type === 'function';
  const isObject = value !== null && type === 'object';
  const keys = isObject ? Object.keys(value) : [];
  const hasDefault = isObject && Object.prototype.hasOwnProperty.call(value, 'default');
  const defaultType = hasDefault ? typeof value.default : undefined;
  const hasPDFParse = isObject && Object.prototype.hasOwnProperty.call(value, 'PDFParse');

  console.log(`\n[${label}]`);
  console.log('typeof:', type);
  console.log('isFunction:', isFunction);
  console.log('isObject:', isObject);
  console.log('keys:', keys);
  console.log('hasDefault:', hasDefault);
  console.log('defaultType:', defaultType);
  console.log('hasPDFParse:', hasPDFParse);
}

function resolvePDFParse(mod) {
  if (!mod) return null;
  if (typeof mod === 'function') return mod;
  if (mod.PDFParse) return mod.PDFParse;
  if (mod.default?.PDFParse) return mod.default.PDFParse;
  if (typeof mod.default === 'function') return mod.default;
  return null;
}

const pdfPathArg = process.argv[2];
const pdfPath = pdfPathArg ? path.resolve(process.cwd(), pdfPathArg) : null;

let required;
try {
  required = require('pdf-parse');
  summarize("require('pdf-parse')", required);
} catch (err) {
  console.log("\n[require('pdf-parse')] failed");
  console.error(err);
}

let imported;
try {
  imported = await import('pdf-parse');
  summarize("import('pdf-parse')", imported);
} catch (err) {
  console.log("\n[import('pdf-parse')] failed");
  console.error(err);
}

if (!pdfPath) {
  console.log('\nNo PDF path provided. Usage: node scripts/inspect-pdf-parse.mjs /path/to/file.pdf');
  process.exit(0);
}

if (!fs.existsSync(pdfPath)) {
  console.error(`\nPDF file not found: ${pdfPath}`);
  process.exit(1);
}

const modForParse = imported ?? required;
const PDFParse = resolvePDFParse(modForParse);

if (!PDFParse) {
  console.error('\nCould not resolve PDFParse entry from loaded module.');
  process.exit(1);
}

try {
  const data = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data });
  const textResult = await parser.getText();
  const text = textResult?.text ?? '';
  console.log('\n[getText()]');
  console.log('textLength:', text.length);
  console.log('textPreview:', text.slice(0, 200));
  if (typeof parser.destroy === 'function') {
    await parser.destroy();
  }
} catch (err) {
  console.error('\nParsing failed');
  console.error(err);
  process.exit(1);
}
