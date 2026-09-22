import { Ajv, type ValidateFunction } from 'ajv';
import type { Tool } from '@modelcontextprotocol/server';

/** One startup snapshot; no dynamic tool discovery in v0.1. Validators never mutate arguments. */
export class ToolCatalog {
  private readonly tools: Tool[];
  private readonly validators = new Map<string, ValidateFunction>();
  constructor(tools: readonly Tool[]) {
    this.tools = structuredClone([...tools]);
    const ajv = new Ajv({ strict: false, coerceTypes: false, useDefaults: false, removeAdditional: false, validateFormats: false });
    for (const tool of this.tools) {
      if (this.validators.has(tool.name)) throw new Error('Duplicate upstream tool name');
      this.validators.set(tool.name, ajv.compile(tool.inputSchema));
    }
  }
  list(): Tool[] { return structuredClone(this.tools); }
  description(name: string): string | undefined { return this.tools.find(tool => tool.name === name)?.description; }
  validate(name: string, args: unknown): 'VALID' | 'UNKNOWN_TOOL' | 'INVALID_ARGUMENTS' {
    const validator = this.validators.get(name);
    if (!validator) return 'UNKNOWN_TOOL';
    return validator(args ?? {}) ? 'VALID' : 'INVALID_ARGUMENTS';
  }
}
