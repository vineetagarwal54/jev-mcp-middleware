import { Client, type Transport, type CallToolRequestParams, type CallToolResult, type Tool } from '@modelcontextprotocol/client';

export class UpstreamClient {
  private readonly client = new Client({ name: 'jev-gateway-upstream', version: '0.1.0' });
  constructor(private readonly timeoutMs = 30000) {}
  async connect(transport: Transport): Promise<void> {
    try { await this.client.connect(transport, { timeout: this.timeoutMs }); }
    catch (error) { await this.client.close(); throw error; }
  }
  async listTools(): Promise<Tool[]> {
    return (await this.client.listTools(undefined, { timeout: this.timeoutMs })).tools;
  }
  callTool(params: CallToolRequestParams, signal?: AbortSignal): Promise<CallToolResult> {
    return this.client.callTool(params, { timeout: this.timeoutMs, ...(signal ? { signal } : {}) });
  }
  close(): Promise<void> { return this.client.close(); }
}
