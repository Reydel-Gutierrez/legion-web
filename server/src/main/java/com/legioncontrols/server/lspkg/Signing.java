package com.legioncontrols.server.lspkg;

/**
 * Java port of backend/src/lib/lspkg/signing.js — package signing interface (LC-ARCH-002 §3, §11).
 * No production key-management system exists in this repo — there is nowhere to safely generate,
 * store, rotate, or distribute a signing private key yet. Pretending to sign packages without that
 * infrastructure would be worse than not signing: it would produce a false sense of tamper-evidence.
 * Until a keystore exists, every package built here is honestly marked {@code signed: false} and
 * carries a checksum (real, verified integrity check) instead of a signature.
 */
public final class Signing {

    private Signing() {
    }

    public record SignatureResult(boolean signed, String algorithm, String signature, String reason) {
    }

    public record VerifyResult(boolean valid, String reason) {
    }

    /** Default/current signer: honestly reports that no key management exists yet. */
    public static SignatureResult sign() {
        return new SignatureResult(false, "none", null,
            "No production key-management system is configured; this is an unsigned development package.");
    }

    public static VerifyResult verify(boolean signed) {
        if (signed) {
            return new VerifyResult(false, "Signature verification is not implemented for signed packages yet.");
        }
        return new VerifyResult(true, "Package is unsigned; integrity was checked via checksum only.");
    }
}
