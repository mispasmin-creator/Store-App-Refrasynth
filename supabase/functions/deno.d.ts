// Minimal declarations for checking the standalone Edge Function with the repo's TypeScript compiler.
declare namespace Deno {
  const env: { get(name: string): string | undefined };
  function serve(handler: (request: Request) => Response | Promise<Response>): void;
}
