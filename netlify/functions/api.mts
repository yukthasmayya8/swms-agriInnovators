import type { Config, Context } from "@netlify/functions";
import serverless from "serverless-http";
import { createApp } from "../../src/app";
import { setJobOrigin } from "../../src/workers/queues";
import { ensureSecrets } from "../../src/config/secrets";

const app = createApp();
app.set("trust proxy", true);

// serverless-http speaks the Lambda/API Gateway event format; translate to and
// from the Web Request/Response used by Netlify Functions.
const handler = serverless(app, { binary: true });

export default async (req: Request, context: Context) => {
  await ensureSecrets();
  const url = new URL(req.url);
  setJobOrigin(url.origin);

  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });
  headers["x-forwarded-for"] = context.ip;

  const multiValueQueryStringParameters: Record<string, string[]> = {};
  url.searchParams.forEach((value, key) => {
    (multiValueQueryStringParameters[key] ||= []).push(value);
  });

  const body = req.method === "GET" || req.method === "HEAD" ? "" : Buffer.from(await req.arrayBuffer()).toString("base64");

  const result: any = await handler(
    {
      httpMethod: req.method,
      path: url.pathname,
      headers,
      multiValueQueryStringParameters,
      body,
      isBase64Encoded: true,
      requestContext: { identity: { sourceIp: context.ip } }
    },
    {}
  );

  const responseHeaders = new Headers();
  for (const [key, value] of Object.entries(result.headers || {})) responseHeaders.set(key, String(value));
  for (const [key, values] of Object.entries(result.multiValueHeaders || {})) {
    responseHeaders.delete(key);
    for (const value of values as unknown[]) responseHeaders.append(key, String(value));
  }

  const status = result.statusCode || 200;
  const responseBody = status === 204 || status === 304 || !result.body
    ? null
    : Buffer.from(result.body, result.isBase64Encoded ? "base64" : "utf-8");
  return new Response(responseBody, { status, headers: responseHeaders });
};

export const config: Config = {
  path: ["/api/*", "/health"]
};
