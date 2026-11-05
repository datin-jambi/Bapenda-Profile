/**
 * In-memory sliding window rate limiter for protecting sensitive endpoints (like login).
 */

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const records = new Map<string, RateLimitRecord>();

// Clean up expired entries periodically every 5 minutes
if (typeof setInterval !== "undefined") {
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of records.entries()) {
      if (now > record.resetTime) {
        records.delete(key);
      }
    }
  }, 5 * 60 * 1000);
  
  if (typeof interval === "object" && "unref" in interval) {
    interval.unref();
  }
}

export function checkRateLimit(
  identifier: string,
  limit: number = 5,
  windowMs: number = 15 * 60 * 1000
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  const record = records.get(identifier);

  if (!record || now > record.resetTime) {
    records.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (record.count >= limit) {
    const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  record.count += 1;
  return {
    allowed: true,
    remaining: limit - record.count,
    retryAfterSeconds: 0,
  };
}

export function resetRateLimit(identifier: string) {
  records.delete(identifier);
}

