// Base64URL to ArrayBuffer converter
export function base64urlToBuffer(base64url) {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (base64.length % 4)) % 4;
  base64 += "=".repeat(padLen);
  const binary = window.atob(base64);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i);
  }
  return buffer.buffer;
}

// ArrayBuffer to Base64URL converter
export function bufferToBase64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// Converts JSON options from backend into the correct format for navigator.credentials.create
export function prepareRegistrationOptions(options) {
  const prepared = { ...options };
  prepared.challenge = base64urlToBuffer(options.challenge);
  prepared.user.id = base64urlToBuffer(options.user.id);
  
  if (options.excludeCredentials) {
    prepared.excludeCredentials = options.excludeCredentials.map(cred => ({
      ...cred,
      id: base64urlToBuffer(cred.id),
    }));
  }
  
  return prepared;
}

// Converts JSON options from backend into the correct format for navigator.credentials.get
export function prepareAuthenticationOptions(options) {
  const prepared = { ...options };
  prepared.challenge = base64urlToBuffer(options.challenge);
  
  if (options.allowCredentials) {
    prepared.allowCredentials = options.allowCredentials.map(cred => ({
      ...cred,
      id: base64urlToBuffer(cred.id),
    }));
  }
  
  return prepared;
}

// Prepares the output of navigator.credentials.create for transmission to backend
export function formatRegistrationCredential(cred) {
  return {
    id: cred.id,
    rawId: bufferToBase64url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: bufferToBase64url(cred.response.clientDataJSON),
      attestationObject: bufferToBase64url(cred.response.attestationObject),
      transports: cred.response.getTransports ? cred.response.getTransports() : [],
    },
  };
}

// Prepares the output of navigator.credentials.get for transmission to backend
export function formatAuthenticationCredential(cred) {
  return {
    id: cred.id,
    rawId: bufferToBase64url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: bufferToBase64url(cred.response.clientDataJSON),
      authenticatorData: bufferToBase64url(cred.response.authenticatorData),
      signature: bufferToBase64url(cred.response.signature),
      userHandle: cred.response.userHandle ? bufferToBase64url(cred.response.userHandle) : null,
    },
  };
}

// Check if WebAuthn / Biometrics are supported on the current device
export function isWebAuthnSupported() {
  return !!(
    window.PublicKeyCredential &&
    navigator.credentials &&
    navigator.credentials.create &&
    navigator.credentials.get
  );
}

// Check if user verification (Face ID/Touch ID/Windows Hello) is available on the current device
export async function isLocalBiometricsAvailable() {
  if (!isWebAuthnSupported()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch (err) {
    console.error("Error checking platform authenticator availability:", err);
    return false;
  }
}
