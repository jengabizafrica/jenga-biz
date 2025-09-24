# Cache Optimization Guide for Jenga-Biz

## Current State Analysis

### Existing Caching Infrastructure

The application currently uses **TanStack Query (React Query)** as the primary client-side data-fetching and caching library:

- **QueryClient** instantiated in `src/App.tsx` with default configuration
- **QueryClientProvider** wraps the entire app at root level
- No explicit stale/cache time configurations found
- Custom hooks leverage React Query for data fetching:
  - `useFinancialInsights` - Financial records and metrics
  - `useImpactMeasurement` - Job creation, loan assessments, survival records
  - `useAnalytics` - User activity tracking

### Current Limitations

1. **No Cache Configuration**: Default React Query settings may not be optimal for all data types
2. **No Persistence**: Cache is lost on page refresh/session end
3. **Missing Invalidation Strategy**: No systematic cache invalidation after mutations
4. **Limited Memoization**: Some React memoization exists but not comprehensive
5. **No Server-Side Caching**: Relying solely on client-side cache

---

## Recommended Caching Improvements

### 1. Configure Query Client with Optimized Defaults

Update `src/App.tsx` to include better default cache settings:

```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from '@tanstack/react-query-persist-client-core';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

// Create persister for localStorage
const localStoragePersister = createSyncStoragePersister({
  storage: window.localStorage,
  throttleTime: 1000,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
    },
    mutations: {
      retry: 1,
    },
  },
});

// Enable persistence
persistQueryClient({
  queryClient,
  persister: localStoragePersister,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
});
```

### 2. Implement Query-Specific Cache Strategies

Create a cache configuration file `src/config/cacheConfig.ts`:

```typescript
export const CACHE_STRATEGIES = {
  // Financial data - moderate freshness needed
  FINANCIAL_RECORDS: {
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 15 * 60 * 1000, // 15 minutes
  },
  
  // Analytics data - can be slightly stale
  ANALYTICS: {
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  },
  
  // User profile - rarely changes
  USER_PROFILE: {
    staleTime: 15 * 60 * 1000, // 15 minutes
    cacheTime: 60 * 60 * 1000, // 1 hour
  },
  
  // Templates - static content
  TEMPLATES: {
    staleTime: 30 * 60 * 1000, // 30 minutes
    cacheTime: 2 * 60 * 60 * 1000, // 2 hours
  },
  
  // Real-time data - always fresh
  LIVE_DATA: {
    staleTime: 0, // Always stale
    cacheTime: 5 * 60 * 1000, // 5 minutes
  },
};
```

### 3. Optimize Custom Hooks with Specific Cache Settings

Update `src/hooks/useFinancialInsights.tsx`:

```typescript
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { CACHE_STRATEGIES } from '@/config/cacheConfig';

export const useFinancialInsights = (businessId?: string) => {
  const queryClient = useQueryClient();
  
  // Query for financial records
  const {
    data: financialRecords = [],
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: ['financialRecords', businessId],
    queryFn: () => fetchFinancialRecords(businessId),
    ...CACHE_STRATEGIES.FINANCIAL_RECORDS,
    enabled: !!businessId,
  });

  // Mutation for adding records
  const addRecordMutation = useMutation({
    mutationFn: addFinancialRecord,
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries(['financialRecords']);
      queryClient.invalidateQueries(['analytics']); // Related data
    },
  });

  // Memoized calculations
  const financialHealthMetrics = useMemo(() => {
    return calculateHealthMetrics(financialRecords);
  }, [financialRecords]);

  return {
    financialRecords,
    loading,
    error,
    addFinancialRecord: addRecordMutation.mutate,
    financialHealthMetrics,
  };
};
```

### 4. Implement Background Refetching for Critical Data

Create `src/hooks/useBackgroundSync.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';

export const useBackgroundSync = () => {
  const { user } = useAuth();
  
  // Critical financial data - refresh every 5 minutes
  useQuery({
    queryKey: ['criticalFinancialData', user?.id],
    queryFn: () => fetchCriticalData(user?.id),
    enabled: !!user,
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    refetchIntervalInBackground: true,
  });
  
  // Analytics data - refresh every 15 minutes
  useQuery({
    queryKey: ['dashboardAnalytics', user?.id],
    queryFn: () => fetchDashboardAnalytics(user?.id),
    enabled: !!user,
    refetchInterval: 15 * 60 * 1000, // 15 minutes
    refetchIntervalInBackground: true,
  });
};
```

### 5. Enhance React Memoization

Update components with comprehensive memoization:

```typescript
import React, { memo, useMemo, useCallback } from 'react';

export const FinancialDashboard = memo(({ businessId }: { businessId: string }) => {
  const { financialRecords, addFinancialRecord } = useFinancialInsights(businessId);
  
  // Memoize expensive calculations
  const chartData = useMemo(() => {
    return processChartData(financialRecords);
  }, [financialRecords]);
  
  // Memoize event handlers
  const handleAddRecord = useCallback((record) => {
    addFinancialRecord(record);
  }, [addFinancialRecord]);
  
  const handleExport = useCallback(() => {
    exportFinancialData(financialRecords);
  }, [financialRecords]);
  
  return (
    <div>
      <FinancialChart data={chartData} />
      <AddRecordForm onSubmit={handleAddRecord} />
      <ExportButton onClick={handleExport} />
    </div>
  );
});
```

### 6. Implement List Virtualization for Large Datasets

For components displaying large lists, implement virtualization:

```typescript
import { FixedSizeList as List } from 'react-window';

export const FinancialRecordsList = memo(({ records }: { records: FinancialRecord[] }) => {
  const memoizedRecords = useMemo(() => records, [records]);
  
  const Row = useCallback(({ index, style }) => (
    <div style={style}>
      <FinancialRecordItem record={memoizedRecords[index]} />
    </div>
  ), [memoizedRecords]);
  
  return (
    <List
      height={400}
      itemCount={records.length}
      itemSize={60}
      itemData={memoizedRecords}
    >
      {Row}
    </List>
  );
});
```

### 7. Create Cache Management Utils

Create `src/utils/cacheUtils.ts`:

```typescript
import { QueryClient } from '@tanstack/react-query';

export const createCacheUtils = (queryClient: QueryClient) => ({
  // Prefetch data for faster navigation
  prefetchData: async (queryKey: string[], queryFn: () => Promise<any>) => {
    await queryClient.prefetchQuery({
      queryKey,
      queryFn,
      staleTime: 5 * 60 * 1000,
    });
  },
  
  // Clear specific cache
  clearCache: (queryKey: string[]) => {
    queryClient.removeQueries(queryKey);
  },
  
  // Warm cache with initial data
  setInitialData: (queryKey: string[], data: any) => {
    queryClient.setQueryData(queryKey, data);
  },
  
  // Invalidate related queries
  invalidateRelated: (patterns: string[]) => {
    patterns.forEach(pattern => {
      queryClient.invalidateQueries([pattern]);
    });
  },
});
```

### 8. Add Cache Performance Monitoring

Create `src/hooks/useCacheMonitoring.ts`:

```typescript
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

export const useCacheMonitoring = () => {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    const cache = queryClient.getQueryCache();
    
    // Monitor cache performance
    const unsubscribe = cache.subscribe((event) => {
      if (event.type === 'queryAdded') {
        console.log('Query added to cache:', event.query.queryKey);
      }
      
      if (event.type === 'queryRemoved') {
        console.log('Query removed from cache:', event.query.queryKey);
      }
    });
    
    // Log cache stats periodically
    const interval = setInterval(() => {
      const queries = cache.getAll();
      const staleQueries = queries.filter(q => q.isStale());
      
      console.log('Cache Stats:', {
        totalQueries: queries.length,
        staleQueries: staleQueries.length,
        cacheSize: JSON.stringify(queries).length,
      });
    }, 60000); // Every minute
    
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [queryClient]);
};
```

### 9. Implement Progressive Enhancement

Add service worker for offline caching (`public/sw.js`):

```javascript
const CACHE_NAME = 'jenga-biz-v1';
const STATIC_ASSETS = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
];

// Cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// Serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
```

### 10. Server-Side Caching Recommendations

#### Supabase Edge Functions
```typescript
// Edge function with caching headers
export default async function handler(req: Request) {
  const data = await fetchData();
  
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300', // 5 minutes
      'Vary': 'Authorization',
    },
  });
}
```

#### Database Query Optimization
- Add database indexes for frequently queried fields
- Use Supabase's built-in query caching
- Implement read replicas for analytics queries

---

## Implementation Priority

### Phase 1 (Immediate - High Impact)
1. Configure QueryClient with optimized defaults
2. Add query-specific cache strategies to existing hooks
3. Implement proper cache invalidation after mutations
4. Add React memoization to expensive calculations

### Phase 2 (Short-term - Performance)
1. Add background refetching for critical data
2. Implement list virtualization for large datasets
3. Create cache management utilities
4. Add cache performance monitoring

### Phase 3 (Long-term - Advanced)
1. Implement service worker for offline support
2. Add server-side caching strategies
3. Implement advanced prefetching patterns
4. Add cache warming on app initialization

---

## Monitoring and Metrics

### Key Performance Indicators
- **Cache Hit Rate**: Target >80%
- **Time to Interactive**: Target <3 seconds
- **First Contentful Paint**: Target <1.5 seconds
- **Network Request Reduction**: Target 50% reduction

### Monitoring Tools
- React Query DevTools for development
- Web Vitals for performance metrics
- Lighthouse for overall performance scoring
- Custom analytics for cache effectiveness

---

## Best Practices

### DO ✅
- Set appropriate stale and cache times per data type
- Invalidate cache after mutations that affect the data
- Use memoization for expensive calculations
- Prefetch data for predictable user journeys
- Monitor cache performance regularly

### DON'T ❌
- Cache sensitive user data in localStorage
- Set overly long cache times for dynamic data
- Forget to handle cache invalidation
- Cache data that changes frequently
- Ignore cache performance metrics

---

This guide provides a comprehensive roadmap for implementing effective caching strategies in the Jenga-Biz application. Start with Phase 1 for immediate performance improvements, then gradually implement additional phases based on user needs and performance metrics.