'use strict';

/**
 * Package signing interface (LC-ARCH-002 §3, §11: "signed/versioned .lspkg", "signed packages
 * ... verified before staging/activation"). No production key-management system exists in this
 * repo — there is nowhere to safely generate, store, rotate, or distribute a signing private key
 * yet. Pretending to sign packages without that infrastructure would be worse than not signing:
 * it would produce a false sense of tamper-evidence. Until a keystore exists, every package built
 * here is honestly marked `signed: false` and carries a checksum (real, verified integrity check)
 * instead of a signature (authenticity/non-repudiation, which checksums alone cannot provide).
 *
 * This module defines the interface future production signing must implement, and ships the
 * default no-op signer so callers never have to special-case "signing is not configured".
 */

/**
 * @typedef {{ signed: boolean, algorithm: string, signature: string|null, reason?: string }} SignatureResult
 * @typedef {{ valid: boolean, reason?: string }} VerifyResult
 */

class Signer {
  /* eslint-disable class-methods-use-this, no-unused-vars */
  /** @param {Buffer} _manifestDigest @returns {Promise<SignatureResult>} */
  async sign(_manifestDigest) {
    throw new Error('Signer.sign() not implemented');
  }

  /** @param {Buffer} _manifestDigest @param {SignatureResult} _signature @returns {Promise<VerifyResult>} */
  async verify(_manifestDigest, _signature) {
    throw new Error('Signer.verify() not implemented');
  }
  /* eslint-enable class-methods-use-this, no-unused-vars */
}

/** Default/current signer: honestly reports that no key management exists yet. */
class UnsignedDevelopmentSigner extends Signer {
  // eslint-disable-next-line class-methods-use-this
  async sign() {
    return {
      signed: false,
      algorithm: 'none',
      signature: null,
      reason: 'No production key-management system is configured; this is an unsigned development package.',
    };
  }

  // eslint-disable-next-line class-methods-use-this
  async verify(_manifestDigest, signature) {
    if (signature && signature.signed) {
      return { valid: false, reason: 'Signature verification is not implemented for signed packages yet.' };
    }
    // An honestly-unsigned package passes "verification" only in the sense that it never claimed
    // to be signed; callers must still gate activation on their own unsigned-package policy.
    return { valid: true, reason: 'Package is unsigned; integrity was checked via checksum only.' };
  }
}

module.exports = { Signer, UnsignedDevelopmentSigner, defaultSigner: new UnsignedDevelopmentSigner() };
