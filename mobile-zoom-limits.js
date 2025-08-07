// Mobile-specific zoom limits for infinite canvas
// Limits zoom to 0.5x - 1.5x on mobile devices

(function() {
    'use strict';
    
    // Mobile detection
    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
            || (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
    }
    
    if (!isMobileDevice()) {
        return; // Exit if not mobile
    }
    
    // Mobile zoom limits
    const MOBILE_MIN_SCALE = 0.25; // this is for how far you can zoom out
    const MOBILE_MAX_SCALE = 2.75; // this is for how far you can zoom in
    
    // Override the handleWheel function with mobile limits
    function mobileHandleWheel(e) {
        e.preventDefault();
        
        const rect = canvasContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Determine zoom direction and factor
        const delta = e.deltaY > 0 ? 1 : -1;
        const zoomFactor = e.ctrlKey || e.metaKey ? 0.99 : 0.985;
        const newScale = Math.max(MOBILE_MIN_SCALE, Math.min(MOBILE_MAX_SCALE, canvasTransform.scale * (zoomFactor ** delta)));
        
        // Apply zoom towards mouse position
        const scaleRatio = newScale / canvasTransform.scale;
        canvasTransform.x = mouseX - (mouseX - canvasTransform.x) * scaleRatio;
        canvasTransform.y = mouseY - (mouseY - canvasTransform.y) * scaleRatio;
        canvasTransform.scale = newScale;
        
        updateCanvasTransform();
        saveCameraToCookie();
    }
    
    // Touch throttling for smooth performance
    let touchUpdateFrame = null;
    let pendingTouchUpdate = null;
    let lastTouchUpdateTime = 0;
    const TOUCH_THROTTLE_INTERVAL = 16; // 60fps throttling

    // Mobile touch handlers with zoom limits
    function mobileHandleTouchStart(e) {
        if (e.touches.length === 1) {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = canvasContainer.getBoundingClientRect();
            touchStartPos = {
                x: touch.clientX - rect.left,
                y: touch.clientY - rect.top
            };
            touchStartTransform = { ...canvasTransform };
            isSingleTouchPanning = true;
        } else if (e.touches.length === 2) {
            e.preventDefault();
            isSingleTouchPanning = false;
            
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const rect = canvasContainer.getBoundingClientRect();
            
            touchStartDistance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) + 
                Math.pow(touch2.clientY - touch1.clientY, 2)
            );
            
            touchStartCenter = {
                x: ((touch1.clientX + touch2.clientX) / 2) - rect.left,
                y: ((touch1.clientY + touch2.clientY) / 2) - rect.top
            };
            
            touchStartTransform = { ...canvasTransform };
        }
    }
    
    function mobileHandleTouchMove(e) {
        if (e.touches.length === 1 && isSingleTouchPanning) {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = canvasContainer.getBoundingClientRect();
            const currentPos = {
                x: touch.clientX - rect.left,
                y: touch.clientY - rect.top
            };
            
            const deltaX = currentPos.x - touchStartPos.x;
            const deltaY = currentPos.y - touchStartPos.y;
            
            canvasTransform.x = touchStartTransform.x + deltaX;
            canvasTransform.y = touchStartTransform.y + deltaY;
            
            updateCanvasTransform();
            
        } else if (e.touches.length === 2) {
            e.preventDefault();
            
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const rect = canvasContainer.getBoundingClientRect();
            
            const currentDistance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) + 
                Math.pow(touch2.clientY - touch1.clientY, 2)
            );
            
            const currentCenter = {
                x: ((touch1.clientX + touch2.clientX) / 2) - rect.left,
                y: ((touch1.clientY + touch2.clientY) / 2) - rect.top
            };
            
            if (touchStartDistance > 0) {
                const scaleChange = currentDistance / touchStartDistance;
                const requestedScale = touchStartTransform.scale * scaleChange;
                const newScale = Math.max(MOBILE_MIN_SCALE, Math.min(MOBILE_MAX_SCALE, requestedScale));
                
                
                const panX = currentCenter.x - touchStartCenter.x;
                const panY = currentCenter.y - touchStartCenter.y;
                
                const scaleRatio = newScale / touchStartTransform.scale;
                canvasTransform.x = touchStartCenter.x - (touchStartCenter.x - touchStartTransform.x) * scaleRatio + panX;
                canvasTransform.y = touchStartCenter.y - (touchStartCenter.y - touchStartTransform.y) * scaleRatio + panY;
                canvasTransform.scale = newScale;
                
                updateCanvasTransform();
            }
        }
    }
    
    function mobileHandleTouchEnd(e) {
        if (e.touches.length === 0) {
            touchStartDistance = 0;
            touchStartCenter = { x: 0, y: 0 };
            touchStartTransform = { x: 0, y: 0, scale: 1 };
            isSingleTouchPanning = false;
            touchStartPos = null;
            
            saveCameraToCookie();
        }
    }
    
    // Wait for DOM to be ready and canvas.js to load
    function initMobileZoomLimits() {
        if (typeof canvasContainer === 'undefined' || typeof canvasTransform === 'undefined') {
            setTimeout(initMobileZoomLimits, 100);
            return;
        }
        
        // Remove existing event listeners
        canvasContainer.removeEventListener('wheel', handleWheel);
        canvasContainer.removeEventListener('touchstart', handleTouchStart);
        canvasContainer.removeEventListener('touchmove', handleTouchMove);
        canvasContainer.removeEventListener('touchend', handleTouchEnd);
        
        // Add mobile-specific event listeners
        canvasContainer.addEventListener('wheel', mobileHandleWheel, { passive: false });
        canvasContainer.addEventListener('touchstart', mobileHandleTouchStart, { passive: false });
        canvasContainer.addEventListener('touchmove', mobileHandleTouchMoveThrottled, { passive: false });
        canvasContainer.addEventListener('touchend', mobileHandleTouchEnd, { passive: false });
        
        // Clamp current scale to mobile limits if needed
        if (canvasTransform.scale < MOBILE_MIN_SCALE || canvasTransform.scale > MOBILE_MAX_SCALE) {
            canvasTransform.scale = Math.max(MOBILE_MIN_SCALE, Math.min(MOBILE_MAX_SCALE, canvasTransform.scale));
            updateCanvasTransform();
        }
        
        // Override updateCanvasTransform to enforce limits
        const originalUpdateCanvasTransform = window.updateCanvasTransform;
        if (originalUpdateCanvasTransform) {
            window.updateCanvasTransform = function() {
                // Enforce mobile limits before updating
                canvasTransform.scale = Math.max(MOBILE_MIN_SCALE, Math.min(MOBILE_MAX_SCALE, canvasTransform.scale));
                return originalUpdateCanvasTransform.call(this);
            };
        }
        
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMobileZoomLimits);
    } else {
        initMobileZoomLimits();
    }
})();