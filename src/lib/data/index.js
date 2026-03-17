// Canonical data-access entry point for Legion Web.
// Pages and components should import from here (or from the specific
// repositories) instead of reaching into mock data files directly.

import * as operatorRepository from "./repositories/operatorRepository";
import * as engineeringRepository from "./repositories/engineeringRepository";
import * as deploymentRepository from "./repositories/deploymentRepository";
import * as accessRepository from "./repositories/accessRepository";

export { USE_MOCK_DATA } from "./config";
export { operatorRepository, engineeringRepository, deploymentRepository, accessRepository };
