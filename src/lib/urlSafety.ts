import dns from "dns/promises";

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

/// Private IPv4 ranges and loopback addresses, per RFC 1918 and RFC 5735.

const PRIVATE_IPV4_RANGES: [string, number][] = [
  ["10.0.0.0", 8],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["0.0.0.0", 8],
];

function ipToInt(ip: string): number {
  return (
    ip
      .split(".")
      .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0
  );
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(Number(p))))
    return false;
  const ipInt = ipToInt(ip);
  return PRIVATE_IPV4_RANGES.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (ipInt & mask) === (ipToInt(base) & mask);
  });
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  return (
    lower === "::1" ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("fe80")
  );
}

// Validates that a URL is safe to crawl. Throws UnsafeUrlError if not.
export async function assertSafeUrl(urlString: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new UnsafeUrlError(`Not a valid URL: ${urlString}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError(`Unsupported protocol: ${url.protocol}`);
  }

  const isProduction = process.env.NODE_ENV === "production";
  if (!isProduction) {
    return url; // local/dev testing against localhost-served sites is expected
  }

  let addresses: string[];
  try {
    const results = await dns.lookup(url.hostname, { all: true });
    addresses = results.map((r) => r.address);
  } catch {
    throw new UnsafeUrlError(`Could not resolve hostname: ${url.hostname}`);
  }

  const unsafe = addresses.some(
    (addr) => isPrivateIPv4(addr) || isPrivateIPv6(addr),
  );
  if (unsafe) {
    throw new UnsafeUrlError(
      `Hostname resolves to a private/loopback address: ${url.hostname}`,
    );
  }

  return url;
}
