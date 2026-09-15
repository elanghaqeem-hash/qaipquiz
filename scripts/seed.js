const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const seedFile = path.join(projectRoot, 'data', 'seed-questions.json');
const dataDir = process.env.QAIP_DATA_DIR
  ? path.resolve(projectRoot, process.env.QAIP_DATA_DIR)
  : path.join(projectRoot, 'data');
const dbFile = path.join(dataDir, 'db.json');

if (!fs.existsSync(seedFile)) {
  console.error(`Seed file tidak ditemukan: ${seedFile}`);
  process.exit(1);
}

const questions = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
if (!Array.isArray(questions)) {
  console.error('seed-questions.json harus berisi array soal.');
  process.exit(1);
}

fs.mkdirSync(dataDir, { recursive: true });

let existing = {};
if (fs.existsSync(dbFile)) {
  try {
    existing = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  } catch {
    console.warn('Runtime database lama tidak valid; akan dibuat ulang.');
  }
}

const database = {
  questions,
  sessions: Array.isArray(existing.sessions) ? existing.sessions : [],
  participants: Array.isArray(existing.participants) ? existing.participants : [],
  answers: Array.isArray(existing.answers) ? existing.answers : [],
  templates: Array.isArray(existing.templates) ? existing.templates : [],
};

const tempFile = `${dbFile}.${process.pid}.tmp`;
fs.writeFileSync(tempFile, JSON.stringify(database, null, 2), 'utf8');
fs.renameSync(tempFile, dbFile);

console.log(`Seed selesai: ${questions.length} soal -> ${dbFile}`);
