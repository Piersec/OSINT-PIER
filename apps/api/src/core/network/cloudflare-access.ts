type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

/**
 * Adds Cloudflare Access service-token headers for server-to-server requests.
 * The values are read only from the backend environment and are never returned
 * in plugin results or logged.
 */
export function cloudflareAccessServiceHeaders(
  environment: RuntimeEnvironment | undefined = process.env,
): Record<string, string> {
  const clientId = environment?.CLOUDFLARE_ACCESS_CLIENT_ID?.trim();
  const clientSecret = environment?.CLOUDFLARE_ACCESS_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) return {};

  return {
    'CF-Access-Client-Id': clientId,
    'CF-Access-Client-Secret': clientSecret,
  };
}
