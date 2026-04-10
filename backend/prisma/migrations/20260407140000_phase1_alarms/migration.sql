-- Phase 1 operator alarms (definitions + events)

CREATE TYPE "AlarmSeverity" AS ENUM ('CRITICAL', 'MAJOR', 'MINOR', 'WARNING');

CREATE TYPE "AlarmRuleCategory" AS ENUM ('BINARY', 'THRESHOLD', 'DEVIATION', 'COMPARISON');

CREATE TYPE "AlarmOperator" AS ENUM (
  'EQ',
  'NEQ',
  'GT',
  'GTE',
  'LT',
  'LTE',
  'IS_ON',
  'IS_OFF',
  'DELTA_GT',
  'DELTA_GTE',
  'DELTA_LT',
  'DELTA_LTE'
);

CREATE TYPE "AlarmEventState" AS ENUM ('ACTIVE', 'CLEARED');

CREATE TABLE "AlarmDefinition" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "buildingId" TEXT,
  "floorId" TEXT,
  "equipmentId" TEXT NOT NULL,
  "pointId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "severity" "AlarmSeverity" NOT NULL DEFAULT 'WARNING',
  "category" "AlarmRuleCategory" NOT NULL,
  "operator" "AlarmOperator" NOT NULL,
  "targetValue" DOUBLE PRECISION,
  "targetPointId" TEXT,
  "deadband" DOUBLE PRECISION,
  "delaySeconds" INTEGER,
  "messageTemplate" TEXT,
  "autoAcknowledge" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AlarmDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AlarmEvent" (
  "id" TEXT NOT NULL,
  "alarmDefinitionId" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "equipmentId" TEXT NOT NULL,
  "pointId" TEXT NOT NULL,
  "state" "AlarmEventState" NOT NULL DEFAULT 'ACTIVE',
  "ack" BOOLEAN NOT NULL DEFAULT false,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "clearedAt" TIMESTAMP(3),
  "lastEvaluatedAt" TIMESTAMP(3),
  "activeValue" TEXT,
  "clearValue" TEXT,
  "message" TEXT NOT NULL,
  "durationSeconds" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AlarmEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AlarmDefinition_siteId_idx" ON "AlarmDefinition"("siteId");
CREATE INDEX "AlarmDefinition_equipmentId_idx" ON "AlarmDefinition"("equipmentId");
CREATE INDEX "AlarmDefinition_pointId_idx" ON "AlarmDefinition"("pointId");
CREATE INDEX "AlarmDefinition_siteId_enabled_idx" ON "AlarmDefinition"("siteId", "enabled");

CREATE INDEX "AlarmEvent_siteId_state_idx" ON "AlarmEvent"("siteId", "state");
CREATE INDEX "AlarmEvent_alarmDefinitionId_state_idx" ON "AlarmEvent"("alarmDefinitionId", "state");
CREATE INDEX "AlarmEvent_equipmentId_idx" ON "AlarmEvent"("equipmentId");

ALTER TABLE "AlarmDefinition" ADD CONSTRAINT "AlarmDefinition_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AlarmDefinition" ADD CONSTRAINT "AlarmDefinition_equipmentId_fkey"
  FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AlarmDefinition" ADD CONSTRAINT "AlarmDefinition_pointId_fkey"
  FOREIGN KEY ("pointId") REFERENCES "Point"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AlarmDefinition" ADD CONSTRAINT "AlarmDefinition_targetPointId_fkey"
  FOREIGN KEY ("targetPointId") REFERENCES "Point"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AlarmEvent" ADD CONSTRAINT "AlarmEvent_alarmDefinitionId_fkey"
  FOREIGN KEY ("alarmDefinitionId") REFERENCES "AlarmDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AlarmEvent" ADD CONSTRAINT "AlarmEvent_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AlarmEvent" ADD CONSTRAINT "AlarmEvent_equipmentId_fkey"
  FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AlarmEvent" ADD CONSTRAINT "AlarmEvent_pointId_fkey"
  FOREIGN KEY ("pointId") REFERENCES "Point"("id") ON DELETE CASCADE ON UPDATE CASCADE;
