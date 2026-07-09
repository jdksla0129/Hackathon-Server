import NodeCache from 'node-cache';

class CacheService {
  private cache: NodeCache;

  constructor() {
    // 기본 TTL: 24시간 (86400초)
    this.cache = new NodeCache({
      stdTTL: 86400,
      checkperiod: 600, // 10분마다 만료된 캐시 삭제
    });
  }

  /**
   * 캐시에서 값을 가져옵니다.
   */
  get<T>(key: string): T | undefined {
    return this.cache.get<T>(key);
  }

  /**
   * 캐시에 값을 설정합니다.
   * @param key 캐시 키
   * @param value 저장할 값
   * @param ttl 만료 시간 (초 단위, 생략 시 기본 24시간)
   */
  set<T>(key: string, value: T, ttl?: number): boolean {
    if (ttl !== undefined) {
      return this.cache.set(key, value, ttl);
    }
    return this.cache.set(key, value);
  }

  /**
   * 캐시에서 해당 키를 삭제합니다.
   */
  del(key: string): number {
    return this.cache.del(key);
  }

  /**
   * 모든 캐시를 비웁니다.
   */
  flush(): void {
    this.cache.flushAll();
  }
}

export const cacheService = new CacheService();
