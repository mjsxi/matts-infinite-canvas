// Client-side media caching module
// Caches images and videos for 24 hours using the Cache API

const CACHE_NAME = 'canvas-media-cache-v1';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const METADATA_KEY = 'canvas-cache-metadata';

// Initialize cache metadata in localStorage
function getCacheMetadata() {
    try {
        const metadata = localStorage.getItem(METADATA_KEY);
        return metadata ? JSON.parse(metadata) : {};
    } catch (error) {
        console.error('Error reading cache metadata:', error);
        return {};
    }
}

function saveCacheMetadata(metadata) {
    try {
        localStorage.setItem(METADATA_KEY, JSON.stringify(metadata));
    } catch (error) {
        console.error('Error saving cache metadata:', error);
    }
}

// Check if a cached item is expired
function isCacheExpired(url) {
    const metadata = getCacheMetadata();
    const entry = metadata[url];

    if (!entry) return true;

    const now = Date.now();
    return (now - entry.timestamp) > CACHE_DURATION;
}

// Add URL to cache with metadata
async function addToCache(url) {
    if (!('caches' in window)) {
        console.warn('Cache API not supported');
        return false;
    }

    try {
        const cache = await caches.open(CACHE_NAME);

        // Fetch and cache the resource
        const response = await fetch(url);
        if (response.ok) {
            await cache.put(url, response.clone());

            // Update metadata
            const metadata = getCacheMetadata();
            metadata[url] = {
                timestamp: Date.now(),
                size: response.headers.get('content-length') || 0
            };
            saveCacheMetadata(metadata);

            return true;
        }
        return false;
    } catch (error) {
        console.error('Error adding to cache:', error);
        return false;
    }
}

// Get cached URL or fetch and cache if not available/expired
async function getCachedUrl(url) {
    if (!('caches' in window)) {
        // Cache API not supported, return original URL
        return url;
    }

    try {
        // Check if cache exists and is not expired
        if (!isCacheExpired(url)) {
            const cache = await caches.open(CACHE_NAME);
            const cachedResponse = await cache.match(url);

            if (cachedResponse) {
                console.log('📦 Using cached media:', url);
                // Return blob URL from cached response
                const blob = await cachedResponse.blob();
                return URL.createObjectURL(blob);
            }
        }

        // Cache miss or expired - fetch and cache
        console.log('🌐 Fetching and caching media:', url);
        await addToCache(url);

        // Get the newly cached version
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(url);

        if (cachedResponse) {
            const blob = await cachedResponse.blob();
            return URL.createObjectURL(blob);
        }

        // Fallback to original URL if caching failed
        return url;
    } catch (error) {
        console.error('Error getting cached URL:', error);
        return url;
    }
}

// Clean up expired cache entries
async function cleanupExpiredCache() {
    if (!('caches' in window)) return;

    try {
        const cache = await caches.open(CACHE_NAME);
        const metadata = getCacheMetadata();
        const now = Date.now();
        let cleanedCount = 0;

        // Check each cached URL
        for (const [url, entry] of Object.entries(metadata)) {
            if ((now - entry.timestamp) > CACHE_DURATION) {
                // Remove from cache
                await cache.delete(url);
                delete metadata[url];
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            console.log(`🧹 Cleaned up ${cleanedCount} expired cache entries`);
            saveCacheMetadata(metadata);
        }
    } catch (error) {
        console.error('Error cleaning up cache:', error);
    }
}

// Get cache statistics
async function getCacheStats() {
    if (!('caches' in window)) {
        return { supported: false };
    }

    try {
        const metadata = getCacheMetadata();
        const urls = Object.keys(metadata);
        const now = Date.now();

        let activeCount = 0;
        let expiredCount = 0;
        let totalSize = 0;

        urls.forEach(url => {
            const entry = metadata[url];
            if ((now - entry.timestamp) > CACHE_DURATION) {
                expiredCount++;
            } else {
                activeCount++;
                totalSize += parseInt(entry.size) || 0;
            }
        });

        return {
            supported: true,
            active: activeCount,
            expired: expiredCount,
            total: urls.length,
            estimatedSize: totalSize,
            cacheName: CACHE_NAME
        };
    } catch (error) {
        console.error('Error getting cache stats:', error);
        return { supported: true, error: error.message };
    }
}

// Clear all cache
async function clearAllCache() {
    if (!('caches' in window)) return;

    try {
        await caches.delete(CACHE_NAME);
        localStorage.removeItem(METADATA_KEY);
        console.log('🗑️ All cache cleared');
    } catch (error) {
        console.error('Error clearing cache:', error);
    }
}

// Preload images from database into cache
async function preloadMediaToCache(urls) {
    if (!('caches' in window) || !Array.isArray(urls)) return;

    console.log(`📥 Preloading ${urls.length} media items to cache...`);

    const promises = urls.map(url => {
        // Only cache if not already cached or expired
        if (isCacheExpired(url)) {
            return addToCache(url);
        }
        return Promise.resolve(true);
    });

    try {
        const results = await Promise.allSettled(promises);
        const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
        console.log(`✅ Preloaded ${successful}/${urls.length} media items to cache`);
    } catch (error) {
        console.error('Error preloading media:', error);
    }
}

// Export module
window.CacheModule = {
    getCachedUrl,
    addToCache,
    cleanupExpiredCache,
    getCacheStats,
    clearAllCache,
    preloadMediaToCache,
    isCacheExpired
};
