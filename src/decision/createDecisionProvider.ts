import type { GatewayConfig } from '../config/schema.js';
import type { DecisionProvider } from './DecisionProvider.js';
import { JevDecisionProvider } from './JevDecisionProvider.js';
import { createLayaContextCheck, LayaDecisionProvider, type LayaClient } from './LayaDecisionProvider.js';

export interface DecisionProviderHandle {
  readonly provider?: DecisionProvider;
  readonly initializationMs: number;
  close(): Promise<void>;
}

export async function createDecisionProvider(config: GatewayConfig['provider']): Promise<DecisionProviderHandle> {
  if (config.type === 'none') return { initializationMs: 0, close: () => Promise.resolve() };
  if (config.type === 'mock') throw new Error('Mock providers are available only in tests and benchmarks');
  if (config.type === 'jev') return { provider: new JevDecisionProvider(config), initializationMs: 0, close: () => Promise.resolve() };
  if (config.type !== 'laya') throw new Error('Unsupported decision provider');

  const started = performance.now();
  const { Laya } = await import('@receptron/laya');
  const options = config.modelDir !== undefined ? { modelDir: config.modelDir } : {
    ...(config.cacheDir === undefined ? {} : { cacheDir: config.cacheDir }),
    ...(config.subfolder === undefined ? {} : { subfolder: config.subfolder }),
    ...(config.revision === undefined ? {} : { revision: config.revision }),
  };
  const laya = await Laya.load(options);
  try {
    const context = await createLayaContextCheck(laya.modelDir, laya.config);
    const client: LayaClient = { systemOne: (state, layaQuestions) => laya.systemOne(state, layaQuestions) };
    return { provider: new LayaDecisionProvider(client, context),
      initializationMs: Math.max(0, Math.round(performance.now() - started)), close: () => laya.close() };
  } catch (error) {
    await laya.close();
    throw error;
  }
}
