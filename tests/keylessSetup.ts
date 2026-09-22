import { vi } from 'vitest';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

// Every core test is keyless. Real Jev is a separate, explicitly opted-in benchmark.
delete process.env.TYPESAFE_API_KEY;
const blocked = (): never => { throw new Error('Network access is disabled in core tests'); };
vi.stubGlobal('fetch', blocked);
vi.spyOn(http, 'request').mockImplementation(blocked);
vi.spyOn(https, 'request').mockImplementation(blocked);
vi.spyOn(net.Socket.prototype, 'connect').mockImplementation(blocked);
