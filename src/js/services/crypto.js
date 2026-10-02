/**
 * Fleet Pulse — Web Crypto Service (AES-256-GCM + PBKDF2)
 *
 * Provides optional client-side authenticated encryption and decryption for backup files.
 * Uses browser-native Web Cryptography API (`crypto.subtle`) with zero external dependencies.
 */

const PBKDF2_ITERATIONS = 100000;

/**
 * Converts a Uint8Array to a Base64 string.
 */
export function uint8ArrayToBase64(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts a Base64 string to a Uint8Array.
 */
export function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derives an AES-GCM 256-bit CryptoKey from a password and salt using PBKDF2.
 */
async function deriveKey(password, saltBytes, iterations = PBKDF2_ITERATIONS, usage = ['encrypt']) {
  const enc = new TextEncoder();
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return globalThis.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    usage
  );
}

/**
 * Checks whether an imported payload is an encrypted Fleet Pulse backup.
 */
export function isEncryptedBackup(payload) {
  return Boolean(
    payload &&
    typeof payload === 'object' &&
    payload.format === 'encrypted' &&
    typeof payload.ciphertext === 'string' &&
    typeof payload.iv === 'string' &&
    typeof payload.salt === 'string'
  );
}

/**
 * Encrypts an arbitrary fleet backup object with AES-256-GCM using a user-specified password.
 *
 * @param {Object} dataObject Plain fleet backup object
 * @param {string} password Secret passphrase
 * @returns {Promise<Object>} Encrypted backup envelope
 */
export async function encryptBackup(dataObject, password) {
  if (!password || typeof password !== 'string' || !password.trim()) {
    throw new Error('A password is required to encrypt the backup.');
  }

  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS, ['encrypt']);

  const enc = new TextEncoder();
  const plainBytes = enc.encode(JSON.stringify(dataObject));

  const cipherBuffer = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plainBytes
  );

  return {
    version: 1,
    format: 'encrypted',
    algorithm: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA-256',
    iterations: PBKDF2_ITERATIONS,
    salt: uint8ArrayToBase64(salt),
    iv: uint8ArrayToBase64(iv),
    ciphertext: uint8ArrayToBase64(new Uint8Array(cipherBuffer)),
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Decrypts an encrypted Fleet Pulse backup using the provided password.
 * Throws a clear error if the password is wrong or the file is corrupted.
 *
 * @param {Object} encryptedPayload Encrypted backup envelope
 * @param {string} password Secret passphrase
 * @returns {Promise<Object>} Plain fleet backup object
 */
export async function decryptBackup(encryptedPayload, password) {
  if (!isEncryptedBackup(encryptedPayload)) {
    throw new Error('Invalid backup file: not an encrypted payload.');
  }

  if (!password || typeof password !== 'string') {
    throw new Error('Please enter the password to decrypt this backup.');
  }

  try {
    const salt = base64ToUint8Array(encryptedPayload.salt);
    const iv = base64ToUint8Array(encryptedPayload.iv);
    const cipherBytes = base64ToUint8Array(encryptedPayload.ciphertext);
    const iterations = Number(encryptedPayload.iterations) || PBKDF2_ITERATIONS;

    const key = await deriveKey(password, salt, iterations, ['decrypt']);

    const plainBuffer = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipherBytes
    );

    const dec = new TextDecoder();
    const jsonText = dec.decode(plainBuffer);
    return JSON.parse(jsonText);
  } catch (err) {
    // If decryption fails due to tag mismatch or bad key
    throw new Error('Incorrect password or corrupted backup file.');
  }
}
