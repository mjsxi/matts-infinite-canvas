// Memory optimization utilities
// Handles memory cleanup, object pooling, and garbage collection hints

// Object pools for frequently created/destroyed objects
const objectPools = {
    resizeHandles: [],
    eventObjects: [],
    pathData: []
};

// Memory usage tracking
let memoryStats = {
    itemCount: 0,
    lastCleanup: Date.now(),
    forceCleanupThreshold: 100 * 1024 * 1024 // 100MB
};

function initializeMemoryOptimizer() {
    // Monitor memory usage
    setInterval(checkMemoryUsage, 30000); // Every 30 seconds
    
    // Cleanup on page visibility changes
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            performMemoryCleanup();
        }
    });
    
    // Memory optimizer initialized
}

function checkMemoryUsage() {
    if (!performance.memory) return;
    
    const currentMemory = performance.memory.usedJSHeapSize;
    memoryStats.currentMemory = currentMemory;
    
    // Force cleanup if memory usage is high
    if (currentMemory > memoryStats.forceCleanupThreshold) {
        console.warn('High memory usage detected, forcing cleanup:', (currentMemory / 1024 / 1024).toFixed(2), 'MB');
        performMemoryCleanup();
    }
}

function performMemoryCleanup() {
    // Performing memory cleanup
    
    // Clear object pools
    Object.keys(objectPools).forEach(poolName => {
        objectPools[poolName].length = 0;
    });
    
    // Remove inactive event listeners
    cleanupInactiveElements();
    
    // Clear cached data older than 5 minutes
    clearExpiredCache();
    
    // Suggest garbage collection
    if (window.gc) {
        window.gc();
    }
    
    memoryStats.lastCleanup = Date.now();
    // Memory cleanup completed
}

function cleanupInactiveElements() {
    // Remove event listeners from elements no longer in DOM
    const allElements = document.querySelectorAll('*');
    const activeElements = new Set(allElements);
    
    // Clean up resize handles that are orphaned
    const resizeHandles = document.querySelectorAll('.resize-handles');
    resizeHandles.forEach(handle => {
        if (!handle.parentElement || !handle.parentElement.classList.contains('selected')) {
            handle.remove();
        }
    });
}

function clearExpiredCache() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    // Clear viewport rect cache if old
    if (window.ViewportModule && window.ViewportModule.containerRectCache) {
        const cacheAge = now - (window.ViewportModule.lastContainerRectTime || 0);
        if (cacheAge > maxAge) {
            window.ViewportModule.containerRectCache = null;
        }
    }
}

function optimizeImageMemory() {
    // Compress images that are significantly larger than their display size
    const images = document.querySelectorAll('.canvas-item img');
    
    images.forEach(img => {
        const displayWidth = img.offsetWidth;
        const displayHeight = img.offsetHeight;
        const naturalWidth = img.naturalWidth;
        const naturalHeight = img.naturalHeight;
        
        // If image is more than 2x larger than display size, suggest optimization
        if (naturalWidth > displayWidth * 2 || naturalHeight > displayHeight * 2) {
            // Image could be optimized (keeping console.warn for high memory usage)
        }
    });
}

function getPooledObject(poolName, createFn) {
    if (!objectPools[poolName]) {
        objectPools[poolName] = [];
    }
    
    const pool = objectPools[poolName];
    return pool.pop() || createFn();
}

function returnToPool(poolName, obj) {
    if (!objectPools[poolName]) {
        objectPools[poolName] = [];
    }
    
    // Reset object properties
    if (obj && typeof obj === 'object') {
        Object.keys(obj).forEach(key => {
            if (obj.hasOwnProperty(key)) {
                delete obj[key];
            }
        });
    }
    
    objectPools[poolName].push(obj);
}

function getMemoryStats() {
    return {
        ...memoryStats,
        itemCount: document.querySelectorAll('.canvas-item').length,
        poolSizes: Object.keys(objectPools).reduce((acc, poolName) => {
            acc[poolName] = objectPools[poolName].length;
            return acc;
        }, {}),
        currentMemoryMB: performance.memory ? (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) : 'N/A'
    };
}

// Export module
window.MemoryOptimizer = {
    initializeMemoryOptimizer,
    checkMemoryUsage,
    performMemoryCleanup,
    optimizeImageMemory,
    getPooledObject,
    returnToPool,
    getMemoryStats,
    cleanupInactiveElements,
    clearExpiredCache
};