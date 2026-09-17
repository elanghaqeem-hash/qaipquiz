import { getCloudflareContext } from '@opennextjs/cloudflare';

const localSecrets = new Map<string, string>();

function randomSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Buffer.from(bytes).toString('base64url');
}

export async function getRuntimeSecret(name: string): Promise<string> {
  if (!/^[a-z0-9_-]{3,64}$/i.test(name)) {
    throw new Error('Nama runtime secret tidak valid');
  }

  try {
    const context = getCloudflareContext();
    const namespace = (context.env as any)?.QUIZ_STORE;
    if (namespace) {
      const id = namespace.idFromName('qaipquiz-global');
      const stub = namespace.get(id);
      const response = await stub.fetch(`https://quiz-store/secret/${encodeURIComponent(name)}`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`Gagal memperoleh runtime secret (${response.status})`);
      }
      const data = await response.json() as { secret?: string };
      if (!data.secret) throw new Error('Runtime secret kosong');
      return data.secret;
    }
  } catch (error: any) {
    const message = String(error?.message || error || '');
    if (message.includes('Gagal memperoleh runtime secret') || message.includes('Runtime secret kosong')) {
      throw error;
    }
  }

  // Local development fallback. This is process-local by design and is never
  // used when the Cloudflare Durable Object binding is available.
  if (!localSecrets.has(name)) localSecrets.set(name, randomSecret());
  return localSecrets.get(name)!;
}
