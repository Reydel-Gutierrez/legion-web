package com.legioncontrols.server.deployment;

import com.legioncontrols.server.common.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Java port of backend/src/modules/deployment/deployment.auth.js — the deployment authentication
 * boundary (LC-ARCH-002 §11: "Mutual authentication or equivalent strong identity for Engineering
 * Workspace and LS-100", "Role-based deployment permission separate from ordinary operator
 * control").
 *
 * This backend has NO authentication system at all today (confirmed: zero auth middleware exists
 * anywhere in the codebase — see SecurityConfig). Rather than pretend to add real identity/
 * authorization here, this is an honest, minimal boundary: a shared-secret bearer token gate,
 * clearly labeled as development-grade. It exists so the deployment endpoints are not silently wide
 * open, and so a real auth system has one obvious place to plug into later.
 *
 * "Do not expose an unauthenticated production deployment endpoint" is enforced by refusing every
 * request when {@code LEGION_PROFILE=ls100-production} and no token is configured.
 */
@Component
public class DeploymentAuth {

    private static final Logger log = LoggerFactory.getLogger(DeploymentAuth.class);

    private volatile boolean warnedOnce = false;

    public void check(HttpServletRequest request) {
        String profile = envOrDefault("LEGION_PROFILE", "engineering");
        String token = System.getenv("LS100_DEPLOY_TOKEN");

        if ("ls100-production".equals(profile)) {
            if (token == null || token.isBlank()) {
                throw new ApiException(501, "Deployment authentication is not configured for this production LS-100 (LS100_DEPLOY_TOKEN unset). Refusing to accept deployment requests.");
            }
            requireBearer(request, token);
            return;
        }

        // engineering / ls100-sim: allow a configured token to be enforced even in dev, but
        // otherwise permit the request through with a one-time loud warning — this is explicitly
        // NOT production auth, and every deployment audit entry still records the caller-supplied
        // actor.
        if (token != null && !token.isBlank()) {
            requireBearer(request, token);
            return;
        }
        if (!warnedOnce) {
            warnedOnce = true;
            log.warn("[deployment.auth] LS100_DEPLOY_TOKEN is not set (profile={}) — deployment endpoints are UNAUTHENTICATED. Development only; never run a production LS-100 this way.", profile);
        }
    }

    private void requireBearer(HttpServletRequest request, String token) {
        String header = request.getHeader("Authorization");
        String presented = header != null && header.startsWith("Bearer ") ? header.substring(7) : null;
        if (presented == null || !presented.equals(token)) {
            throw new ApiException(401, "Missing or invalid deployment credentials");
        }
    }

    private static String envOrDefault(String name, String fallback) {
        String value = System.getenv(name);
        return value != null && !value.isBlank() ? value : fallback;
    }
}
