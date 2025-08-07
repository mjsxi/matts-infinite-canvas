// Viewport and coordinate system management
// Handles coordinate transformations, zoom, pan, and viewport calculations

// Optimized screen to canvas conversion with caching
let containerRectCache = null;
let lastContainerRectTime = 0;
const RECT_CACHE_DURATION = 100; // Cache for 100ms

function getContainerRect() {
    const now = Date.now();
    if (!containerRectCache || (now - lastContainerRectTime) > RECT_CACHE_DURATION) {
        containerRectCache = container.getBoundingClientRect();
        lastContainerRectTime = now;
    }
    return containerRectCache;
}

function screenToCanvas(screenX, screenY) {
    const rect = getContainerRect();
    const canvasX = (screenX - rect.left - canvasTransform.x) / canvasTransform.scale;
    const canvasY = (screenY - rect.top - canvasTransform.y) / canvasTransform.scale;
    return { x: canvasX, y: canvasY };
}

function canvasToScreen(canvasX, canvasY) {
    const rect = getContainerRect();
    const screenX = (canvasX * canvasTransform.scale) + canvasTransform.x + rect.left;
    const screenY = (canvasY * canvasTransform.scale) + canvasTransform.y + rect.top;
    return { x: screenX, y: screenY };
}

function getViewportCenter() {
    const rect = getContainerRect();
    const centerScreenX = rect.width / 2;
    const centerScreenY = rect.height / 2;
    return screenToCanvas(centerScreenX, centerScreenY);
}

function updateCanvasTransform() {
    const transform = `translate(${canvasTransform.x}px, ${canvasTransform.y}px) scale(${canvasTransform.scale})`;
    canvas.style.transform = transform;
    
    // Trigger viewport-aware optimizations
    if (window.PerformanceModule) {
        window.PerformanceModule.optimizeCanvas();
    }
}

function goToCenter() {
    // Store current transform for animation
    const startTransform = { ...canvasTransform };
    const containerRect = container.getBoundingClientRect();
    const targetX = containerRect.width / 2 - centerPoint.x * canvasTransform.scale;
    const targetY = containerRect.height / 2 - centerPoint.y * canvasTransform.scale;
    
    // Add transition for smooth animation
    canvas.style.transition = 'transform 0.6s ease-out';
    
    // Reset to default zoom level (scale = 1)
    canvasTransform.scale = 1;
    
    // Recalculate position with new scale
    const finalX = containerRect.width / 2 - centerPoint.x * canvasTransform.scale;
    const finalY = containerRect.height / 2 - centerPoint.y * canvasTransform.scale;
    
    // Animate to center with default zoom
    canvasTransform.x = finalX;
    canvasTransform.y = finalY;
    updateCanvasTransform();
    
    // Show center indicator only for authenticated admin users
    if (isAuthenticated && window.AdminModule) {
        window.AdminModule.showCenterIndicator(centerPoint.x, centerPoint.y);
    }
    
    // Preload items near the center point
    if (window.DatabaseModule) {
        window.DatabaseModule.preloadItemsNearPoint(centerPoint.x, centerPoint.y, 1000);
    }
    
    // Remove transition after animation
    setTimeout(() => {
        canvas.style.transition = '';
    }, 600);
}

// Export functions for use in other modules
window.ViewportModule = {
    getContainerRect,
    screenToCanvas,
    canvasToScreen,
    getViewportCenter,
    updateCanvasTransform,
    goToCenter
};