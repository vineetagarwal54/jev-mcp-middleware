import { Client, type Transport, type CallToolRequestParams, type CallToolResult, type Tool } from '@modelcontextprotocol/client';

export class UpstreamClient {
  private readonly client = new Client({ name: 'jev-gateway-upstream', version: '0.1.0' });
  constructor(private readonly timeoutMs = 30000) {}
  async connect(transport: Transport): Promise<void> {
    try { await this.client.connect(transport, { timeout: this.timeoutMs }); }
    catch (error) { await this.client.close(); throw error; }
  }
  async listTools(): Promise<Tool[]> {
    if (!this.client.getServerCapabilities()?.tools) return [];
    const tools: Tool[] = [];
    const seenCursors = new Set<string>();
    let cursor: string | null | undefined;
    while (cursor !== null) {
      const page = await this.client.request(
        { method: 'tools/list', params: cursor === undefined ? {} : { cursor } },
        { timeout: this.timeoutMs },
      );
      tools.push(...page.tools);
      if (page.nextCursor !== undefined) {
        if (seenCursors.has(page.nextCursor)) throw new Error('Repeated upstream tools/list cursor');
        seenCursors.add(page.nextCursor);
      }
      cursor = page.nextCursor ?? null;
    }
    return tools;
  }
  callTool(params: CallToolRequestParams, signal?: AbortSignal): Promise<CallToolResult> {
    return this.client.callTool(params, { timeout: this.timeoutMs, ...(signal ? { signal } : {}) });
  }
  close(): Promise<void> { return this.client.close(); }
}
