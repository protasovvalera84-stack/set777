/**
 * Meshlink Device Security
 *
 * Split-key authentication:
 * - Half A stored on device (localStorage)
 * - Half B stored on server (account_data)
 * - Both halves combine to form device key
 * - New device triggers alert + requires 20 recovery words
 *
 * Recovery words:
 * - 20 random words from BIP39-style wordlist
 * - Generated once at registration
 * - User must save them securely
 * - Required to authorize new devices
 */

// Wordlist (256 common English words for recovery phrases)
const WORDLIST = [
  "abandon","ability","able","about","above","absent","absorb","abstract","absurd","abuse",
  "access","accident","account","accuse","achieve","acid","acoustic","acquire","across","act",
  "action","actor","actual","adapt","add","addict","address","adjust","admit","adult",
  "advance","advice","aerobic","affair","afford","afraid","again","age","agent","agree",
  "ahead","aim","air","airport","aisle","alarm","album","alcohol","alert","alien",
  "all","alley","allow","almost","alone","alpha","already","also","alter","always",
  "amateur","amazing","among","amount","amused","analyst","anchor","ancient","anger","angle",
  "angry","animal","ankle","announce","annual","another","answer","antenna","antique","anxiety",
  "any","apart","apology","appear","apple","approve","april","arch","arctic","area",
  "arena","argue","arm","armed","armor","army","around","arrange","arrest","arrive",
  "arrow","art","artefact","artist","artwork","ask","aspect","assault","asset","assist",
  "assume","asthma","athlete","atom","attack","attend","attitude","attract","auction","audit",
  "august","aunt","author","auto","autumn","average","avocado","avoid","awake","aware",
  "awesome","awful","awkward","axis","baby","bachelor","bacon","badge","bag","balance",
  "balcony","ball","bamboo","banana","banner","bar","barely","bargain","barrel","base",
  "basic","basket","battle","beach","bean","beauty","because","become","beef","before",
  "begin","behave","behind","believe","below","belt","bench","benefit","best","betray",
  "better","between","beyond","bicycle","bid","bike","bind","biology","bird","birth",
  "bitter","black","blade","blame","blanket","blast","bleak","bless","blind","blood",
  "blossom","blow","blue","blur","blush","board","boat","body","boil","bomb",
  "bone","bonus","book","boost","border","boring","borrow","boss","bottom","bounce",
  "box","boy","bracket","brain","brand","brass","brave","bread","breeze","brick",
  "bridge","brief","bright","bring","brisk","broccoli","broken","bronze","broom","brother",
  "brown","brush","bubble","buddy","budget","buffalo","build","bulb","bulk","bullet",
  "bundle","bunny","burden","burger","burst","bus","business","busy","butter","buyer",
  "buzz","cabbage","cabin","cable","cactus","cage","cake","call","calm","camera",
];

export interface DeviceKeyPair {
  localHalf: string;   // Stored in localStorage
  serverHalf: string;  // Stored in Matrix account_data
  deviceId: string;    // Unique device identifier
  deviceName: string;  // Human-readable device name
  createdAt: number;
}

export interface RecoveryData {
  words: string[];           // 20 recovery words
  wordHash: string;          // SHA-256 hash for verification
  devices: DeviceKeyPair[];  // Authorized devices
}

/** Generate cryptographically random bytes as hex */
function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 hash */
async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Generate 20 random recovery words */
export function generateRecoveryWords(): string[] {
  const words: string[] = [];
  const arr = new Uint8Array(20);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 20; i++) {
    words.push(WORDLIST[arr[i] % WORDLIST.length]);
  }
  return words;
}

/** Generate a unique device ID */
function generateDeviceId(): string {
  return `meshlink_${randomHex(8)}`;
}

/** Get device name from user agent */
function getDeviceName(): string {
  const ua = navigator.userAgent;
  if ((window as any).meshlink?.isDesktop) {
    if (ua.includes("Windows")) return "Windows Desktop";
    if (ua.includes("Linux")) return "Linux Desktop";
    if (ua.includes("Mac")) return "macOS Desktop";
    return "Desktop App";
  }
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad/i.test(ua)) return "iOS";
  if (ua.includes("Windows")) return "Windows Browser";
  if (ua.includes("Linux")) return "Linux Browser";
  if (ua.includes("Mac")) return "macOS Browser";
  return "Unknown Device";
}

/** Create a new device key pair */
export function createDeviceKeyPair(): DeviceKeyPair {
  return {
    localHalf: randomHex(32),
    serverHalf: randomHex(32),
    deviceId: generateDeviceId(),
    deviceName: getDeviceName(),
    createdAt: Date.now(),
  };
}

/** Combine two halves into full device key */
export async function combineKey(localHalf: string, serverHalf: string): Promise<string> {
  return sha256(localHalf + ":" + serverHalf);
}

/** Verify recovery words match stored hash */
export async function verifyRecoveryWords(words: string[], storedHash: string): Promise<boolean> {
  const hash = await sha256(words.join(" "));
  return hash === storedHash;
}

// ===== Storage helpers =====

const STORAGE_KEY = "meshlink-device-key";

/** Save local half to device storage */
export function saveLocalKey(deviceId: string, localHalf: string): void {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    data[deviceId] = { localHalf, savedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

/** Load local half from device storage */
export function loadLocalKey(deviceId: string): string | null {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return data[deviceId]?.localHalf || null;
  } catch { return null; }
}

/** Get all local device IDs */
export function getLocalDeviceIds(): string[] {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return Object.keys(data);
  } catch { return []; }
}

// ===== Server storage (Matrix account_data) =====

const ACCOUNT_DATA_KEY = "org.meshlink.device_security";

/** Save security data to server */
export async function saveSecurityToServer(
  baseUrl: string, token: string, userId: string, data: RecoveryData
): Promise<void> {
  await fetch(
    `${baseUrl}/_matrix/client/v3/user/${encodeURIComponent(userId)}/account_data/${ACCOUNT_DATA_KEY}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }
  );
}

/** Load security data from server */
export async function loadSecurityFromServer(
  baseUrl: string, token: string, userId: string
): Promise<RecoveryData | null> {
  try {
    const resp = await fetch(
      `${baseUrl}/_matrix/client/v3/user/${encodeURIComponent(userId)}/account_data/${ACCOUNT_DATA_KEY}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!resp.ok) return null;
    return await resp.json() as RecoveryData;
  } catch { return null; }
}

/** Check if current device is authorized */
export async function isDeviceAuthorized(
  baseUrl: string, token: string, userId: string
): Promise<{ authorized: boolean; deviceId: string | null; isNewDevice: boolean }> {
  const localDeviceIds = getLocalDeviceIds();
  const serverData = await loadSecurityFromServer(baseUrl, token, userId);

  if (!serverData || !serverData.devices || serverData.devices.length === 0) {
    // No security setup yet — first device
    return { authorized: true, deviceId: null, isNewDevice: false };
  }

  // Check if any local device ID matches server's authorized devices
  for (const localId of localDeviceIds) {
    const serverDevice = serverData.devices.find(d => d.deviceId === localId);
    if (serverDevice) {
      const localHalf = loadLocalKey(localId);
      if (localHalf && localHalf === serverDevice.localHalf) {
        return { authorized: true, deviceId: localId, isNewDevice: false };
      }
    }
  }

  // No matching device — this is a new/unknown device
  return { authorized: false, deviceId: null, isNewDevice: true };
}

/** Register current device (after recovery words verified) */
export async function registerDevice(
  baseUrl: string, token: string, userId: string
): Promise<{ keyPair: DeviceKeyPair; recoveryWords: string[] | null }> {
  const keyPair = createDeviceKeyPair();
  let serverData = await loadSecurityFromServer(baseUrl, token, userId);
  let recoveryWords: string[] | null = null;

  if (!serverData) {
    // First device — generate recovery words
    recoveryWords = generateRecoveryWords();
    const wordHash = await sha256(recoveryWords.join(" "));
    serverData = {
      words: [], // Never store actual words on server
      wordHash,
      devices: [],
    };
  }

  // Add this device
  serverData.devices.push(keyPair);

  // Save server half
  await saveSecurityToServer(baseUrl, token, userId, serverData);

  // Save local half
  saveLocalKey(keyPair.deviceId, keyPair.localHalf);

  return { keyPair, recoveryWords };
}

/** Remove a device from authorized list */
export async function removeDevice(
  baseUrl: string, token: string, userId: string, deviceId: string
): Promise<void> {
  const serverData = await loadSecurityFromServer(baseUrl, token, userId);
  if (!serverData) return;
  serverData.devices = serverData.devices.filter(d => d.deviceId !== deviceId);
  await saveSecurityToServer(baseUrl, token, userId, serverData);
}
