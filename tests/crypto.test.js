import { describe, it, expect } from 'vitest';
import {
  encryptBackup,
  decryptBackup,
  isEncryptedBackup,
  uint8ArrayToBase64,
  base64ToUint8Array,
} from '../src/js/services/crypto.js';

describe('Web Crypto Service — AES-256-GCM Backup Encryption', () => {
  const sampleFleetData = {
    version: 1,
    exportedAt: '2026-10-01T12:00:00.000Z',
    equipment: [
      { id: 1, unitNumber: 'TRK-101', type: 'tractor', currentOdometer: 142000 },
      { id: 2, unitNumber: 'TRL-201', type: 'trailer', currentOdometer: 55000 },
    ],
    records: [
      { id: 1, equipmentId: 1, date: '2026-05-01', serviceType: 'Oil Change', cost: 350 },
    ],
    fuel: [
      { id: 1, date: '2026-05-02', location: 'Pilot #12', totalCost: 400 },
    ],
    permits: [],
    insurance: [],
    settings: [{ key: 'app', geminiApiKey: 'secret-key-12345' }],
  };

  it('base64 helper functions correctly encode and decode binary buffers', () => {
    const original = new Uint8Array([0, 1, 2, 255, 128, 64, 32, 16, 8, 4]);
    const b64 = uint8ArrayToBase64(original);
    const decoded = base64ToUint8Array(b64);
    expect(decoded).toEqual(original);
  });

  it('encrypts and successfully decrypts backup with the correct password', async () => {
    const password = 'SuperSecretFleetPassword#2026';
    const encrypted = await encryptBackup(sampleFleetData, password);

    expect(isEncryptedBackup(encrypted)).toBe(true);
    expect(encrypted.format).toBe('encrypted');
    expect(encrypted.algorithm).toBe('AES-256-GCM');
    expect(encrypted.ciphertext).toBeTypeOf('string');
    expect(encrypted.salt).toBeTypeOf('string');
    expect(encrypted.iv).toBeTypeOf('string');

    // Decrypt
    const decrypted = await decryptBackup(encrypted, password);
    expect(decrypted).toEqual(sampleFleetData);
  });

  it('fails decryption with an incorrect password', async () => {
    const encrypted = await encryptBackup(sampleFleetData, 'CorrectPassword');
    await expect(decryptBackup(encrypted, 'WrongPassword')).rejects.toThrow(
      'Incorrect password or corrupted backup file.'
    );
  });

  it('detects tampered ciphertext and rejects decryption', async () => {
    const encrypted = await encryptBackup(sampleFleetData, 'ValidPassword');
    // Tamper with one character of the ciphertext
    const tampered = {
      ...encrypted,
      ciphertext: encrypted.ciphertext.slice(0, -4) + 'AAAA',
    };

    await expect(decryptBackup(tampered, 'ValidPassword')).rejects.toThrow(
      'Incorrect password or corrupted backup file.'
    );
  });

  it('rejects empty password on encryption', async () => {
    await expect(encryptBackup(sampleFleetData, '')).rejects.toThrow(
      'A password is required to encrypt the backup.'
    );
    await expect(encryptBackup(sampleFleetData, '   ')).rejects.toThrow(
      'A password is required to encrypt the backup.'
    );
  });

  it('isEncryptedBackup correctly identifies encrypted vs unencrypted backups', () => {
    expect(isEncryptedBackup(null)).toBe(false);
    expect(isEncryptedBackup({})).toBe(false);
    expect(isEncryptedBackup(sampleFleetData)).toBe(false);
    expect(
      isEncryptedBackup({
        version: 1,
        format: 'encrypted',
        ciphertext: 'abc',
        iv: 'def',
        salt: 'ghi',
      })
    ).toBe(true);
  });
});
