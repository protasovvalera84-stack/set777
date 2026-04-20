/**
 * Meshlink Matrix Integration
 *
 * Lightweight helpers for interacting with the Matrix homeserver.
 * The full chat experience is provided by Element Web; these helpers
 * handle registration and login from the Meshlink landing page.
 */

/** Base URL of the Matrix homeserver (same origin in production). */
function getHomeserverUrl(): string {
  // In production, Synapse is behind the same nginx on /_matrix
  return window.location.origin;
}

export interface MatrixLoginResponse {
  user_id: string;
  access_token: string;
  device_id: string;
  home_server: string;
}

export interface MatrixError {
  errcode: string;
  error: string;
}

/** Register a new Matrix account. */
export async function matrixRegister(
  username: string,
  password: string,
  displayName?: string,
): Promise<MatrixLoginResponse> {
  const url = `${getHomeserverUrl()}/_matrix/client/v3/register`;

  // Step 1: Get session (dummy auth flow)
  const initResp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (initResp.status === 401) {
    const initData = await initResp.json();
    const session = initData.session;

    // Step 2: Complete registration with dummy auth
    const regResp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        password,
        initial_device_display_name: "Meshlink Web",
        auth: {
          type: "m.login.dummy",
          session,
        },
      }),
    });

    if (!regResp.ok) {
      const err: MatrixError = await regResp.json();
      throw new Error(err.error || "Registration failed");
    }

    const result: MatrixLoginResponse = await regResp.json();

    // Set display name if provided
    if (displayName && result.access_token) {
      await setDisplayName(result.access_token, result.user_id, displayName);
    }

    return result;
  }

  if (initResp.ok) {
    return initResp.json();
  }

  const err: MatrixError = await initResp.json();
  throw new Error(err.error || "Registration failed");
}

/** Log in to an existing Matrix account. */
export async function matrixLogin(
  username: string,
  password: string,
): Promise<MatrixLoginResponse> {
  const url = `${getHomeserverUrl()}/_matrix/client/v3/login`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "m.login.password",
      identifier: {
        type: "m.id.user",
        user: username,
      },
      password,
      initial_device_display_name: "Meshlink Web",
    }),
  });

  if (!resp.ok) {
    const err: MatrixError = await resp.json();
    throw new Error(err.error || "Login failed");
  }

  return resp.json();
}

/** Set the display name for a user. */
async function setDisplayName(
  accessToken: string,
  userId: string,
  displayName: string,
): Promise<void> {
  const url = `${getHomeserverUrl()}/_matrix/client/v3/profile/${encodeURIComponent(userId)}/displayname`;
  await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ displayname: displayName }),
  });
}

/** Check if the Matrix homeserver is reachable. */
export async function checkHomeserver(): Promise<boolean> {
  try {
    const resp = await fetch(
      `${getHomeserverUrl()}/_matrix/client/versions`,
      { signal: AbortSignal.timeout(5000) },
    );
    return resp.ok;
  } catch {
    return false;
  }
}

/** Store Matrix session in localStorage for Element Web to pick up. */
export function storeSession(session: MatrixLoginResponse): void {
  localStorage.setItem("meshlink-matrix-session", JSON.stringify(session));
}

/** Retrieve stored Matrix session. */
export function getStoredSession(): MatrixLoginResponse | null {
  try {
    const raw = localStorage.getItem("meshlink-matrix-session");
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return null;
}

/** Clear stored session. */
export function clearSession(): void {
  localStorage.removeItem("meshlink-matrix-session");
}
