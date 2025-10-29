/**
 * Service Availability Checker
 * Checks if backend services are available and caches results
 * to avoid repeated failed requests
 */

class ServiceChecker {
  constructor() {
    this.serviceStatus = {
      chat: null,        // null = unknown, true = available, false = unavailable
      notification: null,
      customer: null,
    };
    
    this.lastCheck = {
      chat: null,
      notification: null,
      customer: null,
    };
    
    // Cache duration: 5 minutes
    this.CACHE_DURATION = 5 * 60 * 1000;
  }

  /**
   * Check if enough time has passed to recheck service
   */
  shouldRecheck(service) {
    const lastCheckTime = this.lastCheck[service];
    if (!lastCheckTime) return true;
    
    const now = Date.now();
    return (now - lastCheckTime) > this.CACHE_DURATION;
  }

  /**
   * Mark service as available
   */
  markAvailable(service) {
    this.serviceStatus[service] = true;
    this.lastCheck[service] = Date.now();
  }

  /**
   * Mark service as unavailable
   */
  markUnavailable(service) {
    this.serviceStatus[service] = false;
    this.lastCheck[service] = Date.now();
  }

  /**
   * Check if service is available
   * Returns: true (available), false (unavailable), null (unknown)
   */
  isAvailable(service) {
    // If cache expired, return null to trigger recheck
    if (this.shouldRecheck(service)) {
      return null;
    }
    
    return this.serviceStatus[service];
  }

  /**
   * Reset service status (force recheck)
   */
  reset(service) {
    this.serviceStatus[service] = null;
    this.lastCheck[service] = null;
  }

  /**
   * Reset all services
   */
  resetAll() {
    Object.keys(this.serviceStatus).forEach(service => {
      this.reset(service);
    });
  }
}

// Export singleton instance
const serviceChecker = new ServiceChecker();
export default serviceChecker;
