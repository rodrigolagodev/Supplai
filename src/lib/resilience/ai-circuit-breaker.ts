import { CircuitBreaker } from './CircuitBreaker';

export const aiCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 30000, // 30 seconds
  monitoringPeriod: 60000, // 1 minute
});
