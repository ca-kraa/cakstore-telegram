import fs from 'fs';
import path from 'path';
import { beforeAll, afterAll } from 'vitest';

const devDbPath = path.resolve(process.cwd(), 'dev.db');
const testDbPath = path.resolve(process.cwd(), 'test.db');

beforeAll(() => {
  process.env.DATABASE_URL = 'file:./test.db';
  if (fs.existsSync(devDbPath) && !fs.existsSync(testDbPath)) {
    try {
      fs.copyFileSync(devDbPath, testDbPath);
    } catch {
      // Ignored
    }
  }
});

afterAll(() => {
  if (fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
    } catch {
      // Ignored
    }
  }
});
