// Exercises real PostgreSQL writes inside a transaction that is always rolled back.
require('../src/config/env');
const assert = require('assert');
const prisma = require('../src/lib/prisma');
const rollback = new Error('ROLLBACK_TEST_FIXTURES');

async function main() {
  try {
    await prisma.$transaction(async (tx) => {
      const prismaModule = require.cache[require.resolve('../src/lib/prisma')];
      prismaModule.exports = new Proxy(tx, { get: (target, key) => key === '$transaction' ? (operations) => Promise.all(operations) : target[key] });
      const service = require('../src/modules/operatorDefinitions/operatorDefinitions.service');
      const site = await tx.site.create({ data: { name: 'Durability transaction test' } });
      const foreignSite = await tx.site.create({ data: { name: 'Scope transaction test' } });
      const building = await tx.building.create({ data: { siteId: site.id, name: 'Test building', addressLine1: 'Test', city: 'Test', state: 'Test', postalCode: '00000', country: 'US' } });
      const floor = await tx.floor.create({ data: { buildingId: building.id, name: 'Test floor' } });
      const equipment = await tx.equipment.create({ data: { siteId: site.id, buildingId: building.id, floorId: floor.id, name: 'Test equipment', code: 'TEST', equipmentType: 'FCU' } });
      for (const kind of ['trend', 'schedule']) {
        const payload = kind === 'trend' ? { pointRequirements: [{ pointKey: 'SAT', kind: 'analog' }] } : { weeklyWindows: [{ days: ['Mon'], startTime: '07:00', endTime: '18:00', action: 'Occupied' }] };
        const definition = await service.create(site.id, kind, { name: `${kind} test`, equipmentIds: [equipment.id], ...payload });
        assert.equal(definition.assignments.length, 1);
        await service.assign(site.id, kind, definition.id, { equipmentIds: [equipment.id] });
        const listed = await service.list(site.id, kind);
        assert.equal(listed.length, 1);
        assert.equal(listed[0].assignments.length, 1, 'Assignment upsert must be idempotent');
        assert.deepEqual(listed[0][kind === 'trend' ? 'pointRequirements' : 'weeklyWindows'], Object.values(payload)[0]);
        assert.equal((await service.update(site.id, kind, definition.id, { name: 'Edited', enabled: false })).version, 2);
        await assert.rejects(service.update(foreignSite.id, kind, definition.id, { name: 'Wrong site' }), /not found/);
        await assert.rejects(service.assign(site.id, kind, definition.id, { equipmentIds: [equipment.id, 'missing'] }), /Every assignment/);
        await assert.rejects(service.create(site.id, kind, { name: '', ...payload }), /name is required/);
        await service.unassign(site.id, kind, definition.id, equipment.id);
        assert.equal((await service.list(site.id, kind))[0].assignments.length, 0);
        await service.remove(site.id, kind, definition.id);
        assert.equal((await service.list(site.id, kind)).length, 0);
        console.log(`${kind}: create, reload, update, assignment, site isolation, validation, delete passed`);
      }
      prismaModule.exports = prisma;
      throw rollback;
    }, { timeout: 15000 });
  } catch (error) { if (error !== rollback) throw error; }
  console.log('All test writes rolled back.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
