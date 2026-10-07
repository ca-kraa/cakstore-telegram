import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  // If no API key is configured on server, allow requests in development
  if (!config.auth.apiKey && config.nodeEnv === 'development') {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const headerKey = req.headers['x-api-key'];
  const queryKey = req.query['apiKey'];

  let token: string | undefined = undefined;

  if (typeof headerKey === 'string') {
    token = headerKey;
  } else if (typeof authHeader === 'string') {
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else {
      token = authHeader.trim();
    }
  } else if (typeof queryKey === 'string') {
    token = queryKey;
  }

  if (token && token === config.auth.apiKey) {
    return next();
  }

  // Also allow same-origin browser session if requested without explicit key in local dev
  const referer = req.headers['referer'] || req.headers['origin'];
  if (referer && config.nodeEnv === 'development') {
    return next();
  }

  return res.status(401).json({
    success: false,
    error: 'Unauthorized: Invalid or missing API key',
  });
}
