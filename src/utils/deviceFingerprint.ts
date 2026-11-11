import { computeDeterministicDeviceHash } from './authLogic';

const DEVICE_TOKEN_STORAGE_KEY = 'math_detective_device_hw_token_v1';

export interface ClientNetworkIdentity {
  deviceHash: string;
  ipAddress: string;
  userAgent: string;
}

export function getOrCreateDeviceHash(): string {
  let persistentSeed = '';
  try {
    persistentSeed = localStorage.getItem(DEVICE_TOKEN_STORAGE_KEY) || '';
    if (!persistentSeed) {
      persistentSeed =
        Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
      localStorage.setItem(DEVICE_TOKEN_STORAGE_KEY, persistentSeed);
    }
  } catch {
    persistentSeed = 'fallback-seed';
  }

  const nav = typeof navigator !== 'undefined' ? navigator : ({} as Navigator);
  const scr = typeof screen !== 'undefined' ? screen : ({} as Screen);
  const hwTraits = [
    nav.platform || '',
    nav.language || '',
    String(nav.hardwareConcurrency || ''),
    String(nav.maxTouchPoints || ''),
    `${scr.width || 0}x${scr.height || 0}x${scr.colorDepth || 0}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    persistentSeed,
  ].join('|');

  return computeDeterministicDeviceHash(hwTraits);
}

/**
 * 학교 와이파이 등 동일 공인 IP 환경을 고려하여,
 * IP 조회를 수행하지 않고 기기 고유 MAC 식별자(deviceHash)만을 기준으로 식별합니다.
 */
export async function getClientNetworkIdentity(): Promise<ClientNetworkIdentity> {
  const deviceHash = getOrCreateDeviceHash();
  const userAgent =
    (typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown').slice(
      0,
      240
    ) || 'Unknown';
  return { deviceHash, ipAddress: 'mac-only', userAgent };
}
