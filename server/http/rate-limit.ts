import { ApiError } from './errors.ts'

interface Bucket {
  count: number
  resetAt: number
}

/** Fixed-window limiter kept in memory; enough for a single-process server. */
export class RateLimiter {
  private buckets = new Map<string, Bucket>()
  private readonly limit: number
  private readonly windowMs: number

  constructor(limit: number, windowMs: number) {
    this.limit = limit
    this.windowMs = windowMs
  }

  /** Throws RATE_LIMITED once the key exceeds the limit within the window. */
  hit(key: string, cost = 1) {
    const now = Date.now()
    let bucket = this.buckets.get(key)
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + this.windowMs }
      this.buckets.set(key, bucket)
      if (this.buckets.size > 50_000) this.sweep(now)
    }
    bucket.count += cost
    if (bucket.count > this.limit) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
      throw new ApiError(429, 'RATE_LIMITED', 'Too many requests', {
        headers: { 'Retry-After': String(retryAfter) },
      })
    }
  }

  reset(key: string) {
    this.buckets.delete(key)
  }

  private sweep(now: number) {
    for (const [key, bucket] of this.buckets) if (bucket.resetAt <= now) this.buckets.delete(key)
  }
}
