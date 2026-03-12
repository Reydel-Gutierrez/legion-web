// Canonical data-access entry point for Legion Web.
// Pages and components should import from here (or from the specific
// repositories) instead of reaching into mock data files directly.
// (Uses re-exports compatible with CRA/Babel; avoid "export * as" which needs ES2020.)

import * as operatorRepository from "./repositories/operatorRepository";
import * as engineeringRepository from "./repositories/engineeringRepository";

export { operatorRepository, engineeringRepository };

