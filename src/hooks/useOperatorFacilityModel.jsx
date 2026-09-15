import { useMemo } from "react";
import { useActiveDeployment } from "./useWorkingVersion";
import { buildFacilityTree } from "../lib/operator/facilityTree";

/**
 * Operator facility model for the currently open archive (exactly one Site).
 */
export function useOperatorFacilityModel() {
  const { deployment, loading, error } = useActiveDeployment();
  const tree = useMemo(() => buildFacilityTree(deployment), [deployment]);
  return {
    tree,
    releaseData: deployment || null,
    loading,
    error,
  };
}
