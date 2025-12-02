export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  resetTimeout: number; // Milliseconds before attempting half-open
  monitoringPeriod: number; // Milliseconds to monitor failures
}

/**
 * Circuit Breaker Pattern
 * Prevents cascading failures by stopping requests after threshold
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures: Date[] = [];
  private lastFailureTime?: Date;
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: 3,
      resetTimeout: 30000, // 30 seconds
      monitoringPeriod: 60000, // 1 minute
      ...config,
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is OPEN - service unavailable');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.state = 'closed';
      this.failures = [];
    }
  }

  private onFailure(): void {
    const now = new Date();
    this.lastFailureTime = now;
    this.failures.push(now);

    // Remove old failures outside monitoring period
    this.failures = this.failures.filter(
      f => now.getTime() - f.getTime() < this.config.monitoringPeriod
    );

    if (this.failures.length >= this.config.failureThreshold) {
      this.state = 'open';
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return true;

    const now = new Date();
    return now.getTime() - this.lastFailureTime.getTime() >= this.config.resetTimeout;
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = 'closed';
    this.failures = [];
    this.lastFailureTime = undefined;
  }
}
