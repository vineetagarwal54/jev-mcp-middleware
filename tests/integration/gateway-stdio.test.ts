import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { stringify } from 'yaml';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

it('runs host → gateway → upstream over stdio with protocol-only stdout and stderr audit logs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'jev-stdio-'));
  const configPath = join(directory, 'gateway.yaml');
  await writeFile(configPath, stringify({ version: 1, upstream: { command: process.execPath, args: ['--import', 'tsx', 'tests/fixtures/fakeMcpServer.ts'], cwd: process.cwd() }, audit: { sqlitePath: ':memory:' } }));
  const transport = new StdioClientTransport({ command: process.execPath, args: ['--import', 'tsx', resolve('src/index.ts'), '--config', configPath], cwd: process.cwd(), stderr: 'pipe' });
  let stderr = '';
  transport.stderr?.on('data', chunk => { stderr += String(chunk); });
  const client = new Client({ name: 'stdio-test', version: '1' });
  const protocolErrors: Error[] = [];
  client.onerror = error => protocolErrors.push(error);
  try {
    await client.connect(transport);
    expect((await client.listTools()).tools.map(t => t.name)).toEqual(['echo']);
    expect(await client.callTool({ name: 'echo', arguments: { text: 'stdio-secret-canary' } })).toMatchObject({ content: [{ type: 'text', text: 'stdio-secret-canary' }] });
    expect(protocolErrors).toEqual([]);
  } finally { await client.close(); await rm(directory, { recursive: true, force: true }); }
  expect(stderr).toContain('tool_decision');
  expect(stderr).not.toContain('stdio-secret-canary');
});
