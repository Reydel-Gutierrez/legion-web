// Read-only recovery audit. Does not apply migrations or modify site data.
require('../src/config/env');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const prisma = require('../src/lib/prisma');

async function main() {
  const migrations = await prisma.$queryRaw`SELECT migration_name, checksum, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at`;
  for (const name of ['20260907100000_alarm_condition_tree', '20260907110000_operator_durable_definitions']) {
    const row = migrations.find((item) => item.migration_name === name && item.finished_at && !item.rolled_back_at);
    assert(row, `${name} is not successfully applied`);
    const sql = fs.readFileSync(path.join(__dirname, '../prisma/migrations', name, 'migration.sql'));
    assert.equal(crypto.createHash('sha256').update(sql).digest('hex'), row.checksum, `${name} checksum mismatch`);
    console.log(`${name}: applied, checksum matches, finished ${row.finished_at.toISOString()}`);
  }
  const columns = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'AlarmDefinition' AND column_name = 'conditionTree'`;
  assert.equal(columns.length, 1, 'Alarm conditionTree column missing');
  for (const model of ['trendDefinition', 'trendAssignment', 'scheduleDefinition', 'scheduleAssignment']) {
    console.log(`${model}: table readable, ${await prisma[model].count()} rows`);
  }
  const sites = await prisma.site.findMany({ select: { id: true, name: true, activeReleaseVersionId: true, _count: { select: { buildings: true, equipment: true, points: true, siteVersions: true } } } });
  console.log(JSON.stringify(sites, null, 2));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
