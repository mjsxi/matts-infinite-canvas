// Mobile-specific zoom limits for infinite canvas
// Limits zoom to 0.5x - 1.5x on mobile devices

(function() {
    'use strict';
    
    // Mobile detection
    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
            || (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
    }
    
    // If the device has a fine pointer (mouse/trackpad), treat it like desktop.
    // This includes iPad with Magic Keyboard/trackpad, where users expect desktop-like pan/zoom.
    const hasFinePointer = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches;
    if (hasFinePointer || !isMobileDevice()) {
        // Hide loader immediately on desktop-like devices
        const loader = document.getElementById('mobileLoader');
        if (loader) {
            loader.remove();
        }
        return; // Do not override desktop/trackpad behavior
    }
    
    // Mobile zoom limits
    const MOBILE_MIN_SCALE = 0.25; // this is for how far you can zoom out
    const MOBILE_MAX_SCALE = 2.75; // this is for how far you can zoom in
    
    // Override the handleWheel function with mobile limits
    function mobileHandleWheel(e) {
        e.preventDefault();
        
        const rect = window.container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // On touch-only mobile, emulate desktop behavior: two-finger scroll pans, pinch-zoom zooms
        const isZoomGesture = e.ctrlKey || e.metaKey || Math.abs(e.deltaZ || 0) > 0 || e.deltaMode === 1;
        if (isZoomGesture) {
            const delta = e.deltaY;
            const zoomFactor = e.ctrlKey || e.metaKey ? 0.99 : 0.985;
            const requestedScale = canvasTransform.scale * (zoomFactor ** delta);
            const newScale = Math.max(MOBILE_MIN_SCALE, Math.min(MOBILE_MAX_SCALE, requestedScale));
            const scaleRatio = newScale / canvasTransform.scale;
            canvasTransform.x = mouseX - (mouseX - canvasTransform.x) * scaleRatio;
            canvasTransform.y = mouseY - (mouseY - canvasTransform.y) * scaleRatio;
            canvasTransform.scale = newScale;
        } else {
            const panSpeed = 1.0;
            canvasTransform.x -= e.deltaX * panSpeed;
            canvasTransform.y -= e.deltaY * panSpeed;
        }
        
        window.ViewportModule?.updateCanvasTransform();
    }
    
    // Touch throttling for smooth performance
    let touchUpdateFrame = null;
    let pendingTouchUpdate = null;
    let lastTouchUpdateTime = 0;
    const TOUCH_THROTTLE_INTERVAL = 16; // 60fps throttling

    // Function to hide the mobile loader
    function hideMobileLoader() {
        const loader = document.getElementById('mobileLoader');
        if (loader) {
            loader.classList.add('fade-out');
            setTimeout(() => {
                loader.remove();
            }, 500);
        }
    }

    // Track if canvas is ready for touch
    let canvasReady = false;

    // Mobile touch handlers with zoom limits
    function mobileHandleTouchStart(e) {
        // Hide loader on first touch - canvas is now ready
        if (!canvasReady) {
            canvasReady = true;
            hideMobileLoader();
        }
        
        if (e.touches.length === 1) {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = window.container.getBoundingClientRect();
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
            const rect = window.container.getBoundingClientRect();
            
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
    
    // Throttled touch move handler for 60fps performance
    function mobileHandleTouchMoveThrottled(e) {
        // Store the latest touch event
        pendingTouchUpdate = e;
        
        // Only process if enough time has passed
        const now = performance.now();
        if (now - lastTouchUpdateTime >= TOUCH_THROTTLE_INTERVAL) {
            processTouchMove();
        } else if (!touchUpdateFrame) {
            // Schedule next update
            touchUpdateFrame = requestAnimationFrame(() => {
                processTouchMove();
                touchUpdateFrame = null;
            });
        }
    }

    function processTouchMove() {
        if (!pendingTouchUpdate) return;
        
        const e = pendingTouchUpdate;
        lastTouchUpdateTime = performance.now();
        
        mobileHandleTouchMove(e);
        pendingTouchUpdate = null;
    }

    function mobileHandleTouchMove(e) {
        if (e.touches.length === 1 && isSingleTouchPanning) {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = window.container.getBoundingClientRect();
            const currentPos = {
                x: touch.clientX - rect.left,
                y: touch.clientY - rect.top
            };
            
            const deltaX = currentPos.x - touchStartPos.x;
            const deltaY = currentPos.y - touchStartPos.y;
            
            canvasTransform.x = touchStartTransform.x + deltaX;
            canvasTransform.y = touchStartTransform.y + deltaY;
            
            window.ViewportModule?.updateCanvasTransform();
            
        } else if (e.touches.length === 2) {
            e.preventDefault();
            
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const rect = window.container.getBoundingClientRect();
            
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
                
                window.ViewportModule?.updateCanvasTransform();
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
        }
    }
    
    // Wait for DOM to be ready and canvas.js to load
    function initMobileZoomLimits() {
        if (typeof window.container === 'undefined' || typeof canvasTransform === 'undefined') {
            setTimeout(initMobileZoomLimits, 100);
            return;
        }
        
        // Remove existing event listeners
        window.container.removeEventListener('wheel', window.EventsModule?.handleWheel);
        window.container.removeEventListener('touchstart', window.EventsModule?.handleTouchStart);
        window.container.removeEventListener('touchmove', window.EventsModule?.handleTouchMoveThrottled);
        window.container.removeEventListener('touchend', window.EventsModule?.handleTouchEnd);
        
        // Add mobile-specific event listeners
        window.container.addEventListener('wheel', mobileHandleWheel, { passive: false });
        window.container.addEventListener('touchstart', mobileHandleTouchStart, { passive: false });
        window.container.addEventListener('touchmove', mobileHandleTouchMoveThrottled, { passive: false });
        window.container.addEventListener('touchend', mobileHandleTouchEnd, { passive: false });
        
        // Clamp current scale to mobile limits if needed
        if (canvasTransform.scale < MOBILE_MIN_SCALE || canvasTransform.scale > MOBILE_MAX_SCALE) {
            canvasTransform.scale = Math.max(MOBILE_MIN_SCALE, Math.min(MOBILE_MAX_SCALE, canvasTransform.scale));
            window.ViewportModule?.updateCanvasTransform();
        }
        
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMobileZoomLimits);
    } else {
        initMobileZoomLimits();
    }
    
    // Fallback: hide loader after 3 seconds if still visible
    setTimeout(() => {
        if (!canvasReady) {
            canvasReady = true;
            hideMobileLoader();
        }
    }, 3000);
})();