import { createHash, createHmac } from "node:crypto";

/**
 * Минимальный клиент S3-совместимого хранилища: PUT, GET, DELETE и список
 * объектов по префиксу. Подпись — AWS Signature V4 на стандартной криптографии
 * Node, без SDK. Работает с Yandex Object Storage, Selectel, VK Cloud, MinIO.
 *
 * Адресация path-style: https://endpoint/bucket/key — её поддерживают все
 * перечисленные хранилища, и она не требует DNS-записей под бакет.
 */

export interface S3Config {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function s3ConfigFromEnv(): S3Config | null {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  if (!endpoint || !bucket) return null;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("Для S3 задайте S3_ACCESS_KEY_ID и S3_SECRET_ACCESS_KEY");
  }
  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    bucket,
    region: process.env.S3_REGION?.trim() || "ru-central1",
    accessKeyId,
    secretAccessKey,
  };
}

const EMPTY_HASH = createHash("sha256").update("").digest("hex");

function sha256(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

/** Кодирование по RFC 3986, как требует SigV4 (слеши в пути сохраняются). */
function encode(value: string, keepSlash = false): string {
  const encoded = encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return keepSlash ? encoded.replace(/%2F/g, "/") : encoded;
}

export interface SignInput {
  method: string;
  /** Полный адрес запроса */
  url: URL;
  /** Дополнительные подписываемые заголовки (в нижнем регистре) */
  headers?: Record<string, string>;
  payloadHash: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  date: Date;
}

/** Заголовки запроса с подписью SigV4. Вынесено отдельно — для проверки на эталоне AWS. */
export function signRequest(input: SignInput): Record<string, string> {
  const amzDate = input.date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const day = amzDate.slice(0, 8);

  const headers: Record<string, string> = {
    host: input.url.host,
    "x-amz-content-sha256": input.payloadHash,
    "x-amz-date": amzDate,
    ...input.headers,
  };
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((name) => `${name}:${headers[name].trim()}\n`).join("");
  const signedHeaders = names.join(";");

  const query = [...input.url.searchParams.entries()]
    .map(([key, value]) => [encode(key), encode(value)])
    .sort(([a, x], [b, y]) => (a === b ? (x < y ? -1 : 1) : a < b ? -1 : 1))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  // Путь уже закодирован в URL — раскодируем и кодируем заново по правилам SigV4
  const path = decodeURIComponent(input.url.pathname);
  const canonicalRequest = [
    input.method,
    encode(path, true),
    query,
    canonicalHeaders,
    signedHeaders,
    input.payloadHash,
  ].join("\n");

  const scope = `${day}/${input.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n");

  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${input.secretAccessKey}`, day), input.region), "s3"),
    "aws4_request",
  );
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  return {
    ...headers,
    authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

export class S3Client {
  constructor(private readonly config: S3Config) {}

  private url(key = "", query: Record<string, string> = {}): URL {
    const path = key ? `/${encode(this.config.bucket)}/${encode(key, true)}` : `/${encode(this.config.bucket)}`;
    const url = new URL(this.config.endpoint + path);
    for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
    return url;
  }

  private async send(
    method: string,
    url: URL,
    body?: Uint8Array,
    extraHeaders: Record<string, string> = {},
  ): Promise<Response> {
    const signed = signRequest({
      method,
      url,
      headers: extraHeaders,
      payloadHash: body ? sha256(body) : EMPTY_HASH,
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
      region: this.config.region,
      date: new Date(),
    });
    const { host: _host, ...headers } = signed;
    return fetch(url, { method, headers, body: body ? Buffer.from(body) : undefined });
  }

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    const response = await this.send("PUT", this.url(key), bytes, { "content-type": contentType });
    if (!response.ok) throw new Error(`S3 PUT ${key}: ${response.status} ${await response.text()}`);
  }

  async get(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
    const response = await this.send("GET", this.url(key));
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`S3 GET ${key}: ${response.status}`);
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") ?? "application/octet-stream",
    };
  }

  async delete(key: string): Promise<void> {
    const response = await this.send("DELETE", this.url(key));
    if (!response.ok && response.status !== 404) throw new Error(`S3 DELETE ${key}: ${response.status}`);
  }

  async list(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let token: string | undefined;
    do {
      const query: Record<string, string> = { "list-type": "2", prefix };
      if (token) query["continuation-token"] = token;
      const response = await this.send("GET", this.url("", query));
      if (!response.ok) throw new Error(`S3 LIST ${prefix}: ${response.status}`);
      const xml = await response.text();
      for (const match of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) keys.push(decodeXml(match[1]));
      token = /<IsTruncated>true<\/IsTruncated>/.test(xml)
        ? decodeXml(xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1] ?? "")
        : undefined;
    } while (token);
    return keys;
  }
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
