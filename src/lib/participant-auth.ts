import { getRuntimeSecret } from './runtime-secret';

const PARTICIPANT_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

export type ParticipantTokenPayload = {
  participantId: string;
  sessionId: string;
  roomCode: string;
  iat: number;
  exp: number;
};

function base64url(input: Uint8Array | string): string {
  const buffer = typeof input === 'string' ? Buffer.from(input, 'utf8') : Buffer.from(input);
  return buffer.toString('base64url');
}

function fromBase64url(input: string): Uint8Array {
  return new Uint8Array(Buffer.from(input, 'base64url'));
}

function toArrayBuffer(input: Uint8Array): ArrayBuffer {
  return Uint8Array.from(input).buffer;
}

async function getParticipantSecret(): Promise<string> {
  const secret = process.env.PARTICIPANT_TOKEN_SECRET || process.env.AUTH_TOKEN_SECRET || process.env.AUTH_ADMIN_PASSWORD;
  if (secret) return secret;
  return getRuntimeSecret('participant-token');
}

async function sign(value: string): Promise<string> {
  const secretBytes = new TextEncoder().encode(await getParticipantSecret());
  const valueBytes = new TextEncoder().encode(value);
  const key = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(secretBytes),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, toArrayBuffer(valueBytes));
  return base64url(new Uint8Array(signature));
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function issueParticipantToken(input: {
  participantId: string;
  sessionId: string;
  roomCode: string;
}): Promise<string> {
  const now = Date.now();
  const payload: ParticipantTokenPayload = {
    participantId: input.participantId,
    sessionId: input.sessionId,
    roomCode: input.roomCode.toUpperCase(),
    iat: now,
    exp: now + PARTICIPANT_TOKEN_TTL_MS,
  };
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${await sign(encoded)}`;
}

export async function verifyParticipantToken(
  token: string,
  expected?: Partial<Pick<ParticipantTokenPayload, 'participantId' | 'sessionId' | 'roomCode'>>
): Promise<ParticipantTokenPayload | null> {
  try {
    const [encoded, signature] = token.split('.');
    if (!encoded || !signature) return null;

    const expectedSignature = await sign(encoded);
    if (!constantTimeEqual(fromBase64url(signature), fromBase64url(expectedSignature))) return null;

    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as ParticipantTokenPayload;
    if (!payload.participantId || !payload.sessionId || !payload.roomCode || !payload.exp) return null;
    if (payload.exp < Date.now()) return null;

    if (expected?.participantId && payload.participantId !== expected.participantId) return null;
    if (expected?.sessionId && payload.sessionId !== expected.sessionId) return null;
    if (expected?.roomCode && payload.roomCode !== expected.roomCode.toUpperCase()) return null;

    return payload;
  } catch {
    return null;
  }
}
