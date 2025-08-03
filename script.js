// Supabase Configuration
const SUPABASE_URL = 'https://ruefemuqeehlqieitoma.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1ZWZlbXVxZWVobHFpZWl0b21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxNzc5ODQsImV4cCI6MjA2OTc1Mzk4NH0.Bl3Af45EF-RINH_MD5AcZITNbk4wj79cm3Znsbrpb9k';

// Initialize Supabase
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// Global Variables
let canvas;
let isAdmin = false;
let userId = null;
let userNickname = null;
let isSettingCenter = false;
let centerIndicator = null;
let adminSessionExpiry = null;
let canvasCenterPoint = { x: 0, y: 0 };
let dotGridEnabled = true;
let dotGridCanvas = null;
let dotGridCtx = null;

// Image styling variables - easy to customize
const IMAGE_STYLING = {
    shadowColor: 'rgba(0, 0, 0, 0.25)',
    shadowBlur: 28,
    shadowOffsetX: 0,
    shadowOffsetY: 8,
    borderRadius: 20 // Rounded corners radius in pixels
};

// User label styling variables - easy to customize
const LABEL_STYLING = {
    fontSize: 8,
    fontFamily: 'sans-serif',
    textColor: '#ffffff',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    ownItemBackgroundColor: 'rgba(102, 126, 234, 0.8)',
    paddingHorizontal: 8, // Left and right padding
    paddingVertical: 4,    // Top and bottom padding
    borderRadius: 6,
    offsetY: 6 // Pixels above the object
};

// Admin password (change this!)
const ADMIN_PASSWORD = 'canvas123';

// Dot grid configuration
const DOT_GRID_CONFIG = {
    spacing: 40,                    // Distance between dots in pixels
    dotSize: 1.25,                    // Dot radius in pixels
    color: 'rgba(0, 0, 0, 0.1)', // Dot color with alpha transparency
    minZoomToShow: 0.3,            // Minimum zoom level to show dots
    maxZoomToShow: 8.0             // Maximum zoom level to show dots
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeCanvas();
    initializeDotGrid();
    initializeUser();
    bindEvents();
    loadCanvasItems();
    loadCenterPoint();
    setupRealtime();
    
    // Check admin session every 5 minutes
    setInterval(checkAdminSession, 5 * 60 * 1000);
});

// Initialize Fabric.js Canvas
function initializeCanvas() {
    // Detect if we're on mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                     (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
    
    canvas = new fabric.Canvas('canvas', {
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: '#ffffff',
        preserveObjectStacking: true,
        selection: !isMobile,      // Disable selection on mobile
        skipTargetFind: isMobile   // Disable object interaction on mobile
    });
    
    // Hide editing controls on mobile
    if (isMobile) {
        hideEditingControlsOnMobile();
    }

    // Figma-style trackpad interactions
    canvas.on('mouse:wheel', function(opt) {
        const e = opt.e;
        
        // Detect zoom gestures:
        // - Ctrl/Cmd key held (common zoom modifier)
        // - deltaZ exists (pinch gesture on some browsers)
        // - deltaMode 1 (line mode, often indicates trackpad pinch)
        // - Very small deltaX/deltaY values with precise deltaY (trackpad zoom)
        const isZoomGesture = e.ctrlKey || e.metaKey || 
                             Math.abs(e.deltaZ || 0) > 0 ||
                             e.deltaMode === 1 ||
                             (Math.abs(e.deltaX) < 4 && Math.abs(e.deltaY) > 0 && Math.abs(e.deltaY % 1) > 0);
        
        if (isZoomGesture) {
            // Zoom behavior (pinch to zoom on trackpad, or Ctrl+scroll)
            const delta = e.deltaY;
            let zoom = canvas.getZoom();
            
            // More responsive zoom speed for trackpad
            const zoomFactor = e.ctrlKey || e.metaKey ? 0.99 : 0.985;
            zoom *= zoomFactor ** delta;
            
            if (zoom > 20) zoom = 20;
            if (zoom < 0.01) zoom = 0.01;
            canvas.zoomToPoint({ x: e.offsetX, y: e.offsetY }, zoom);
        } else {
            // Pan behavior (2-finger scroll on trackpad)
            const vpt = canvas.viewportTransform;
            
            // Scale pan speed for better control
            const panSpeed = 1.0;
            vpt[4] -= e.deltaX * panSpeed; // Horizontal pan
            vpt[5] -= e.deltaY * panSpeed; // Vertical pan
            canvas.requestRenderAll();
        }
        
        // Update object coordinates and handles after viewport changes
        updateObjectHandles();
        
        // Update HTML iframe positions after zoom
        updateHtmlElementPositions();
        
        e.preventDefault();
        e.stopPropagation();
    });

    // Touch gesture support for mobile/tablet with Safari fixes
    let lastTouchDistance = 0;
    let lastTouchCenter = { x: 0, y: 0 };
    let touchStartTime = 0;
    
    // Handle touch events more carefully for Safari
    let singleTouchStart = { x: 0, y: 0 };
    let isSingleTouchPanning = false;
    
    // Inertia scrolling variables
    let lastTouchMoveTime = 0;
    let touchVelocity = { x: 0, y: 0 };
    let inertiaAnimationId = null;
    const INERTIA_DECAY = 0.95; // Velocity decay factor (0-1, lower = faster decay)
    const MIN_VELOCITY = 0.5; // Minimum velocity to continue animation
    const VELOCITY_SAMPLES = 3; // Number of recent velocity samples to average
    let velocityHistory = [];
    
    canvas.wrapperEl.addEventListener('touchstart', function(e) {
        touchStartTime = Date.now();
        
        // Stop any ongoing inertia animation
        if (inertiaAnimationId) {
            cancelAnimationFrame(inertiaAnimationId);
            inertiaAnimationId = null;
        }
        
        if (e.touches.length === 1) {
            // Single finger touch - ALWAYS prevent default to stop mouse event conversion
            e.preventDefault();
            e.stopPropagation();
            
            // Prepare for panning
            singleTouchStart = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            };
            isSingleTouchPanning = false;
            
            // Reset velocity tracking
            touchVelocity = { x: 0, y: 0 };
            velocityHistory = [];
            lastTouchMoveTime = Date.now();
        } else if (e.touches.length === 2) {
            // Two finger touch - prevent default for zoom/pan
            e.preventDefault();
            e.stopPropagation();
        }
    }, { passive: false });
    
    canvas.wrapperEl.addEventListener('touchmove', function(e) {
        if (e.touches.length === 1) {
            // Single finger panning - ALWAYS prevent default first
            e.preventDefault();
            e.stopPropagation();
            
            const touch = e.touches[0];
            const deltaX = touch.clientX - singleTouchStart.x;
            const deltaY = touch.clientY - singleTouchStart.y;
            const currentTime = Date.now();
            const timeDelta = Math.max(currentTime - lastTouchMoveTime, 1); // Prevent division by zero
            
            // Start panning with any movement (no threshold)
            if (Math.abs(deltaX) > 0 || Math.abs(deltaY) > 0) {
                isSingleTouchPanning = true;
                
                // Calculate velocity for inertia
                const velocityX = deltaX / timeDelta * 16; // Normalize to ~60fps
                const velocityY = deltaY / timeDelta * 16;
                
                // Store velocity sample in history
                velocityHistory.push({ x: velocityX, y: velocityY });
                if (velocityHistory.length > VELOCITY_SAMPLES) {
                    velocityHistory.shift(); // Keep only recent samples
                }
                
                // Update viewport for panning
                const vpt = canvas.viewportTransform;
                vpt[4] += deltaX;
                vpt[5] += deltaY;
                canvas.requestRenderAll();
                
                // Update object handles during touch panning
                updateObjectHandles();
                
                // Update HTML iframe positions during touch panning
                updateHtmlElementPositions();
                
                // Update start position for next movement
                singleTouchStart = {
                    x: touch.clientX,
                    y: touch.clientY
                };
                lastTouchMoveTime = currentTime;
            }
        } else if (e.touches.length === 2) {
            e.preventDefault();
            e.stopPropagation();
            
            // Two-finger gesture
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            
            // Calculate distance between touches (for zoom)
            const distance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) + 
                Math.pow(touch2.clientY - touch1.clientY, 2)
            );
            
            // Calculate center point between touches
            const center = {
                x: (touch1.clientX + touch2.clientX) / 2,
                y: (touch1.clientY + touch2.clientY) / 2
            };
            
            if (lastTouchDistance > 0) {
                // Zoom based on distance change with increased sensitivity
                const rawZoomDelta = distance / lastTouchDistance;
                const zoomDelta = 1 + (rawZoomDelta - 1) * 2.5; // Amplify zoom changes
                let zoom = canvas.getZoom() * zoomDelta;
                
                if (zoom > 20) zoom = 20;
                if (zoom < 0.01) zoom = 0.01;
                
                const rect = canvas.getElement().getBoundingClientRect();
                const pointer = {
                    x: center.x - rect.left,
                    y: center.y - rect.top
                };
                canvas.zoomToPoint(pointer, zoom);
                
                // Update HTML iframe positions after touch zoom
                updateHtmlElementPositions();
                
                // Pan based on center movement
                if (lastTouchCenter.x !== 0 && lastTouchCenter.y !== 0) {
                    const vpt = canvas.viewportTransform;
                    vpt[4] += (center.x - lastTouchCenter.x);
                    vpt[5] += (center.y - lastTouchCenter.y);
                    canvas.requestRenderAll();
                }
            }
            
            lastTouchDistance = distance;
            lastTouchCenter = center;
        }
    }, { passive: false });
    
    canvas.wrapperEl.addEventListener('touchend', function(e) {
        // Reset touch tracking
        lastTouchDistance = 0;
        lastTouchCenter = { x: 0, y: 0 };
        
        // Always prevent Safari from converting touch to mouse events
        e.preventDefault();
        e.stopPropagation();
        
        // Start inertia animation if user was panning and has sufficient velocity
        if (isSingleTouchPanning && velocityHistory.length > 0) {
            // Calculate average velocity from recent samples
            const avgVelocity = velocityHistory.reduce((acc, v) => ({
                x: acc.x + v.x,
                y: acc.y + v.y
            }), { x: 0, y: 0 });
            
            touchVelocity.x = avgVelocity.x / velocityHistory.length;
            touchVelocity.y = avgVelocity.y / velocityHistory.length;
            
            // Only start inertia if velocity is significant
            const velocityMagnitude = Math.sqrt(touchVelocity.x * touchVelocity.x + touchVelocity.y * touchVelocity.y);
            if (velocityMagnitude > MIN_VELOCITY) {
                startInertiaAnimation();
            }
        }
        
        // Reset panning state
        isSingleTouchPanning = false;
        velocityHistory = [];
    }, { passive: false });
    
    // Inertia animation function
    function startInertiaAnimation() {
        function animate() {
            // Apply current velocity to viewport
            const vpt = canvas.viewportTransform;
            vpt[4] += touchVelocity.x;
            vpt[5] += touchVelocity.y;
            canvas.requestRenderAll();
            
            // Update HTML iframe positions during inertia
            updateHtmlElementPositions();
            
            // Update object handles during inertia
            updateObjectHandles();
            
            // Decay velocity
            touchVelocity.x *= INERTIA_DECAY;
            touchVelocity.y *= INERTIA_DECAY;
            
            // Continue animation if velocity is still significant
            const velocityMagnitude = Math.sqrt(touchVelocity.x * touchVelocity.x + touchVelocity.y * touchVelocity.y);
            if (velocityMagnitude > MIN_VELOCITY) {
                inertiaAnimationId = requestAnimationFrame(animate);
            } else {
                inertiaAnimationId = null;
                touchVelocity = { x: 0, y: 0 };
            }
        }
        
        inertiaAnimationId = requestAnimationFrame(animate);
    }
    
    // Additional Safari fixes - prevent all mouse events that could be converted from touch
    canvas.wrapperEl.addEventListener('mousedown', function(e) {
        // If this is a converted touch event (common in Safari), prevent it
        if (Date.now() - touchStartTime < 500) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }, { passive: false });
    
    canvas.wrapperEl.addEventListener('mouseup', function(e) {
        // If this is a converted touch event (common in Safari), prevent it
        if (Date.now() - touchStartTime < 500) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }, { passive: false });
    
    canvas.wrapperEl.addEventListener('click', function(e) {
        // If this is a converted touch event (common in Safari), prevent it
        if (Date.now() - touchStartTime < 500) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }, { passive: false });

    // Pan on middle mouse button or when no object is selected
    canvas.on('mouse:down', function(opt) {
        // Stop any ongoing inertia animation
        if (inertiaAnimationId) {
            cancelAnimationFrame(inertiaAnimationId);
            inertiaAnimationId = null;
            touchVelocity = { x: 0, y: 0 };
        }
        
        const evt = opt.e;
        if (evt.button === 1 || (!canvas.getActiveObject() && !isSettingCenter)) {
            canvas.isDragging = true;
            canvas.selection = false;
            canvas.lastPosX = evt.clientX;
            canvas.lastPosY = evt.clientY;
        }
    });

    canvas.on('mouse:move', function(opt) {
        if (canvas.isDragging) {
            const e = opt.e;
            const vpt = canvas.viewportTransform;
            vpt[4] += e.clientX - canvas.lastPosX;
            vpt[5] += e.clientY - canvas.lastPosY;
            canvas.requestRenderAll();
            canvas.lastPosX = e.clientX;
            canvas.lastPosY = e.clientY;
            
            // Update object handles during dragging
            updateObjectHandles();
        }
    });

    canvas.on('mouse:up', function(opt) {
        if (isSettingCenter) {
            setCenterPoint(opt.e);
            return;
        }
        canvas.isDragging = false;
        canvas.selection = true;
    });

    // Handle object modifications
    canvas.on('object:modified', function(e) {
        console.log('Object modified event fired for:', e.target);
        updateCanvasItem(e.target);
        // Label position updates automatically via setCoords override
    });
    
    // Handle object scaling (resizing)
    canvas.on('object:scaling', function(e) {
        // For images, ensure aspect ratio is maintained during scaling
        if (e.target.itemType === 'image') {
            const obj = e.target;
            // Force uniform scaling by making scaleX and scaleY equal
            const scale = Math.max(obj.scaleX, obj.scaleY);
            obj.set({
                scaleX: scale,
                scaleY: scale
            });
            canvas.requestRenderAll();
        }
    });
    
    canvas.on('object:scaled', function(e) {
        console.log('Object scaled event fired for:', e.target);
        
        // For images, ensure aspect ratio is maintained by using uniform scaling
        if (e.target.itemType === 'image') {
            const obj = e.target;
            // Force uniform scaling by making scaleX and scaleY equal
            const scale = Math.max(obj.scaleX, obj.scaleY);
            obj.set({
                scaleX: scale,
                scaleY: scale
            });
        }
        
        // For HTML objects, allow free resizing and update position
        if (e.target.itemType === 'html') {
            positionHtmlElement(e.target);
        }
        
        updateCanvasItem(e.target);
        // Label position updates automatically via setCoords override
    });
    
    // Handle object moving
    canvas.on('object:moved', function(e) {
        console.log('Object moved event fired for:', e.target);
        updateCanvasItem(e.target);
        // Update HTML position if it's an HTML object
        if (e.target.itemType === 'html') {
            positionHtmlElement(e.target);
        }
        // Label position updates automatically via setCoords override
    });
    
    // Handle object rotating
    canvas.on('object:rotated', function(e) {
        console.log('Object rotated event fired for:', e.target);
        updateCanvasItem(e.target);
        // Update HTML position if it's an HTML object
        if (e.target.itemType === 'html') {
            positionHtmlElement(e.target);
        }
        // Label position updates automatically via setCoords override
    });
    
    // Handle text editing
    canvas.on('text:changed', function(e) {
        console.log('Text changed event fired for:', e.target);
        updateCanvasItem(e.target);
    });
    
    canvas.on('text:editing:exited', function(e) {
        console.log('Text editing exited event fired for:', e.target);
        updateCanvasItem(e.target);
    });

    // Handle object selection for permissions and z-index controls
    canvas.on('selection:created', function(e) {
        checkObjectPermissions(e.selected[0]);
        toggleZIndexControls(true);
        toggleBorderRadiusControls(e.selected[0]);
        toggleTextControls(e.selected[0]);
        // HTML blocks don't need repositioning on selection - they should stay in place
    });

    canvas.on('selection:updated', function(e) {
        checkObjectPermissions(e.selected[0]);
        toggleZIndexControls(true);
        toggleBorderRadiusControls(e.selected[0]);
        toggleTextControls(e.selected[0]);
        // HTML blocks don't need repositioning on selection - they should stay in place
    });
    
    canvas.on('selection:cleared', function() {
        toggleZIndexControls(false);
        toggleBorderRadiusControls(null);
        toggleTextControls(null);
        // Exit interaction mode for any HTML blocks when selection is cleared
        canvas.getObjects().forEach(obj => {
            if (obj.itemType === 'html' && obj.interactionMode) {
                exitHtmlInteractionMode(obj);
            }
        });
    });
    
    // Handle canvas clicks to exit HTML interaction mode
    canvas.on('mouse:down', function(e) {
        // If clicking on empty canvas (no target), exit any HTML interaction modes
        if (!e.target) {
            canvas.getObjects().forEach(obj => {
                if (obj.itemType === 'html' && obj.interactionMode) {
                    exitHtmlInteractionMode(obj);
                }
            });
        }
    });
    
    // Also check permissions when objects are modified
    canvas.on('object:modified', function(e) {
        checkObjectPermissions(e.target);
    });
    
    // Handle label dragging to move parent objects
    canvas.on('object:moving', function(e) {
        const movingObject = e.target;
        
        // Check if this is a label being moved
        if (movingObject.parentObject) {
            const parentObject = movingObject.parentObject;
            
            // Check permissions - user can only move their own items
            if (parentObject.userId === userId || isAdmin) {
                // Calculate how much the label moved
                const labelDeltaX = movingObject.left - movingObject.originalLeft;
                const labelDeltaY = movingObject.top - movingObject.originalTop;
                
                // Move the parent object by the same amount
                parentObject.set({
                    left: parentObject.originalLeft + labelDeltaX,
                    top: parentObject.originalTop + labelDeltaY
                });
                
                // Update the label position to stay attached to parent
                updateUserLabelPosition(parentObject, movingObject);
                
                canvas.requestRenderAll();
            } else {
                // Reset label position if user doesn't have permission
                movingObject.set({
                    left: movingObject.originalLeft,
                    top: movingObject.originalTop
                });
                showStatus('You can only move your own items', 'error');
            }
        }
    });
    
    // Store original positions when starting to move
    canvas.on('mouse:down', function(e) {
        if (e.target) {
            e.target.originalLeft = e.target.left;
            e.target.originalTop = e.target.top;
            
            // If moving a label, also store parent object's position
            if (e.target.parentObject) {
                e.target.parentObject.originalLeft = e.target.parentObject.left;
                e.target.parentObject.originalTop = e.target.parentObject.top;
            }
        }
    });
    
    // Update database when label dragging is finished
    canvas.on('object:modified', function(e) {
        const modifiedObject = e.target;
        
        // If a label was moved, update the parent object in database
        if (modifiedObject.parentObject) {
            updateCanvasItem(modifiedObject.parentObject);
        }
    });

    // Update labels when canvas viewport changes (pan/zoom)
    canvas.on('mouse:up', function() {
        // Update all labels after mouse operations (helps with panning/zooming)
        setTimeout(() => {
            canvas.getObjects().forEach(obj => {
                if (obj.userLabel && obj.itemType) {
                    updateUserLabelPosition(obj, obj.userLabel);
                }
            });
            // Also update HTML positions after mouse operations
            updateHtmlElementPositions();
        }, 10);
    });

    // Resize canvas on window resize
    window.addEventListener('resize', function() {
        canvas.setDimensions({
            width: window.innerWidth,
            height: window.innerHeight
        });
        // Update HTML positions after resize
        setTimeout(() => {
            updateHtmlElementPositions();
        }, 50);
    });
}

// Update object handles and coordinates after viewport changes
function updateObjectHandles() {
    // Update coordinates for all objects so handles follow properly
    canvas.getObjects().forEach(obj => {
        if (obj.setCoords) {
            obj.setCoords();
        }
    });
    
    // If there's an active object, update its controls
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
        activeObject.setCoords();
        canvas.requestRenderAll();
    }
}

// Update HTML iframe positions during zoom/pan operations
function updateHtmlElementPositions() {
    canvas.getObjects().forEach(obj => {
        if (obj.itemType === 'html' && obj.iframeElement) {
            positionHtmlElement(obj);
        }
    });
}

// Enter HTML interaction mode
function enterHtmlInteractionMode(htmlObj) {
    if (!htmlObj || htmlObj.itemType !== 'html') return;
    
    // Only allow if user owns the object or is admin
    if (htmlObj.userId !== userId && !isAdmin) {
        showStatus('You can only interact with your own HTML blocks', 'error');
        return;
    }
    
    htmlObj.interactionMode = true;
    htmlObj.selectable = false;
    htmlObj.evented = false;
    htmlObj.stroke = '#4ade80'; // Green border for interaction mode
    htmlObj.strokeDashArray = [4, 2]; // Shorter dashes
    canvas.discardActiveObject(); // Deselect to hide transform controls
    
    // Update iframe pointer events
    positionHtmlElement(htmlObj);
    canvas.renderAll();
    
    showStatus('HTML interaction enabled - click outside to exit', 'success');
}

// Exit HTML interaction mode
function exitHtmlInteractionMode(htmlObj) {
    if (!htmlObj || htmlObj.itemType !== 'html') return;
    
    htmlObj.interactionMode = false;
    htmlObj.stroke = '#667eea'; // Blue border for container mode
    htmlObj.strokeDashArray = [8, 4]; // Normal dashes
    
    // Update iframe pointer events
    positionHtmlElement(htmlObj);
    canvas.renderAll();
    
    showStatus('Container mode enabled', 'success');
}

// Initialize Dot Grid
function initializeDotGrid() {
    if (!dotGridEnabled) return;
    
    // Create a separate canvas element for the dot grid
    createDotGridCanvas();
    
    // Update dots on canvas changes
    canvas.on('after:render', updateDotGrid);
    canvas.on('mouse:wheel', updateDotGrid);
    canvas.on('mouse:up', updateDotGrid);
    
    console.log('Dot grid system initialized');
}

function createDotGridCanvas() {
    // Create canvas element for dots
    dotGridCanvas = document.createElement('canvas');
    dotGridCanvas.id = 'dotGridCanvas';
    dotGridCanvas.style.position = 'absolute';
    dotGridCanvas.style.top = '0';
    dotGridCanvas.style.left = '0';
    dotGridCanvas.style.zIndex = '0'; // Behind main canvas
    dotGridCanvas.style.pointerEvents = 'none'; // Don't capture mouse events
    dotGridCanvas.width = window.innerWidth;
    dotGridCanvas.height = window.innerHeight;
    
    // Insert before the main canvas
    const mainCanvas = document.getElementById('canvas');
    mainCanvas.parentNode.insertBefore(dotGridCanvas, mainCanvas);
    
    dotGridCtx = dotGridCanvas.getContext('2d');
    
    // Update size on window resize
    window.addEventListener('resize', () => {
        dotGridCanvas.width = window.innerWidth;
        dotGridCanvas.height = window.innerHeight;
        updateDotGrid();
    });
}

function updateDotGrid() {
    if (!dotGridEnabled || !dotGridCtx) return;
    
    const zoom = canvas.getZoom();
    const shouldShow = zoom >= DOT_GRID_CONFIG.minZoomToShow && zoom <= DOT_GRID_CONFIG.maxZoomToShow;
    
    // Clear the dot grid canvas
    dotGridCtx.clearRect(0, 0, dotGridCanvas.width, dotGridCanvas.height);
    
    if (!shouldShow) return;
    
    const vpt = canvas.viewportTransform;
    const spacing = DOT_GRID_CONFIG.spacing * zoom;
    
    // Set dot style
    dotGridCtx.fillStyle = DOT_GRID_CONFIG.color;
    
    // Calculate grid offset based on viewport transform
    const offsetX = vpt[4] % spacing;
    const offsetY = vpt[5] % spacing;
    
    // Draw dots
    for (let x = offsetX; x < dotGridCanvas.width; x += spacing) {
        for (let y = offsetY; y < dotGridCanvas.height; y += spacing) {
            dotGridCtx.beginPath();
            dotGridCtx.arc(x, y, DOT_GRID_CONFIG.dotSize, 0, 2 * Math.PI);
            dotGridCtx.fill();
        }
    }
}

// Initialize User Session with Persistence
function initializeUser() {
    userId = localStorage.getItem('canvas_user_id');
    userNickname = localStorage.getItem('canvas_user_nickname');
    
    console.log('Initializing user:', { userId, userNickname });
    
    // Check for admin session
    const adminSession = localStorage.getItem('canvas_admin_session');
    if (adminSession && Date.now() < parseInt(adminSession)) {
        isAdmin = true;
        adminSessionExpiry = parseInt(adminSession);
    }
    
    if (!userNickname) {
        console.log('No nickname found, showing user modal');
        showUserModal();
    } else {
        // If we have a nickname, use it as the user_id
        userId = userNickname;
        localStorage.setItem('canvas_user_id', userNickname);
        console.log('Using nickname as userId:', userId);
        updateUserInfo();
        // Show admin tools if admin session is valid
        if (isAdmin) {
            toggleAdminMode();
        }
    }
}

// Check Admin Session Expiry
function checkAdminSession() {
    if (isAdmin && adminSessionExpiry && Date.now() > adminSessionExpiry) {
        isAdmin = false;
        localStorage.removeItem('canvas_admin_session');
        adminSessionExpiry = null;
        toggleAdminMode();
        showStatus('Admin session expired', 'error');
    }
}

// Bind Event Listeners
function bindEvents() {
    document.getElementById('addImageBtn').addEventListener('click', addImage);
    document.getElementById('addTextBtn').addEventListener('click', addTextDirectly);
    document.getElementById('addIframeBtn').addEventListener('click', showHtmlModal);
    document.getElementById('adminBtn').addEventListener('click', showAdminModal);
    document.getElementById('setCenterBtn').addEventListener('click', toggleSetCenter);
    document.getElementById('clearCanvasBtn').addEventListener('click', clearCanvas);
    document.getElementById('fileInput').addEventListener('change', handleFileUpload);
    document.getElementById('bringToFrontBtn').addEventListener('click', bringToFront);
    document.getElementById('sendToBackBtn').addEventListener('click', sendToBack);
    document.getElementById('borderRadiusInput').addEventListener('input', updateBorderRadius);
    
    // Text control event listeners
    document.getElementById('fontFamilySelect').addEventListener('change', updateTextProperty);
    document.getElementById('fontSizeInput').addEventListener('input', updateTextProperty);
    document.getElementById('fontWeightSelect').addEventListener('change', updateTextProperty);
    document.getElementById('textColorInput').addEventListener('input', updateTextProperty);
    document.getElementById('lineHeightInput').addEventListener('input', updateTextProperty);
}

// Mobile-specific functions
function hideEditingControlsOnMobile() {
    // Hide the entire toolbar on mobile
    const toolbar = document.getElementById('toolbar');
    toolbar.style.display = 'none';
}

// User Management
function showUserModal() {
    document.getElementById('userModal').classList.remove('hidden');
}

function setUserNickname() {
    const nickname = document.getElementById('userNickname').value.trim();
    console.log('Setting nickname:', nickname);
    
    if (nickname) {
        userNickname = nickname;
        userId = nickname; // Use nickname as user_id
        localStorage.setItem('canvas_user_nickname', nickname);
        localStorage.setItem('canvas_user_id', nickname); // Store nickname as user_id
        console.log('Nickname saved to localStorage:', nickname);
        document.getElementById('userModal').classList.add('hidden');
        updateUserInfo();
        
        // Show admin tools if admin session is valid
        if (isAdmin) {
            toggleAdminMode();
        }
        
        console.log('User setup complete');
    } else {
        console.log('No nickname provided');
    }
}

function updateUserInfo() {
    const userInfo = document.getElementById('userInfo');
    if (isAdmin) {
        userInfo.textContent = `👑 ${userNickname} (Admin)`;
    } else {
        userInfo.textContent = `👤 ${userNickname}`;
    }
}

// Admin Functions
function showAdminModal() {
    if (isAdmin) {
        // If already admin, provide logout option
        if (confirm('You are currently in admin mode. Do you want to logout?')) {
            logoutAdmin();
        }
    } else {
        document.getElementById('adminModal').classList.remove('hidden');
    }
}

function checkAdminPassword() {
    const password = document.getElementById('adminPassword').value;
    if (password === ADMIN_PASSWORD) {
        isAdmin = true;
        
        // Save admin session (expires in 24 hours)
        const expiry = Date.now() + (24 * 60 * 60 * 1000);
        localStorage.setItem('canvas_admin_session', expiry);
        adminSessionExpiry = expiry;
        
        closeAdminModal();
        toggleAdminMode();
        updateUserInfo();
        // showStatus('Admin mode activated (24h session)', 'success');
    } else {
        showStatus('Invalid password', 'error');
    }
}

function logoutAdmin() {
    isAdmin = false;
    localStorage.removeItem('canvas_admin_session');
    adminSessionExpiry = null;
    toggleAdminMode();
    updateUserInfo();
    // showStatus('Admin logout successful', 'success');
}

function closeAdminModal() {
    document.getElementById('adminModal').classList.add('hidden');
    document.getElementById('adminPassword').value = '';
}

function toggleAdminMode() {
    const adminTools = document.getElementById('adminTools');
    const adminBtn = document.getElementById('adminBtn');
    
    if (isAdmin) {
        adminTools.style.display = 'flex';
        adminBtn.textContent = '👑 Admin Mode';
        adminBtn.style.background = 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)';
        adminBtn.title = 'Click to logout';
        
        // Show center indicator if exists
        loadCenterPoint();
    } else {
        adminTools.style.display = 'none';
        adminBtn.textContent = '⚙️ Admin';
        adminBtn.style.background = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
        adminBtn.title = 'Login as admin';
        
        // Hide center indicator
        if (centerIndicator) {
            canvas.remove(centerIndicator);
            centerIndicator = null;
        }
    }
}

// Center Point Management
function toggleSetCenter() {
    isSettingCenter = !isSettingCenter;
    const btn = document.getElementById('setCenterBtn');
    
    if (isSettingCenter) {
        btn.textContent = '✖️ Cancel';
        btn.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)';
        // showStatus('Click anywhere to set center point', 'success');
    } else {
        btn.textContent = '📍 Set Center';
        btn.style.background = 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
    }
}

async function setCenterPoint(event) {
    if (!isAdmin || !isSettingCenter) return;
    
    const rect = canvas.getElement().getBoundingClientRect();
    const point = canvas.getPointer(event);
    
    try {
        // Update center point in database
        const { error } = await supabaseClient
            .from('canvas_center')
            .upsert({
                id: 0,
                x: point.x,
                y: point.y,
                is_active: true
            });
        
        if (error) throw error;
        
        // Update global center point
        canvasCenterPoint = { x: point.x, y: point.y };
        
        showCenterIndicator(point.x, point.y);
        // showStatus('Center point updated!', 'success');
        toggleSetCenter();
    } catch (error) {
        console.error('Error setting center:', error);
        showStatus('Error setting center point', 'error');
    }
}

function showCenterIndicator(x, y) {
    // Remove existing indicator
    if (centerIndicator) {
        canvas.remove(centerIndicator);
    }
    
    // Add new indicator (only visible to admin)
    if (isAdmin) {
        centerIndicator = new fabric.Circle({
            left: x,
            top: y,
            radius: 10,
            fill: '#ff6b6b',
            stroke: '#ffffff',
            strokeWidth: 3,
            selectable: false,
            evented: false,
            opacity: 0.8
        });
        canvas.add(centerIndicator);
        canvas.bringObjectToFront(centerIndicator);
    }
}

async function loadCenterPoint() {
    try {
        const { data, error } = await supabaseClient
            .from('canvas_center')
            .select('*')
            .eq('is_active', true)
            .single();
        
        if (data && !error) {
            // Store the center point for new items
            canvasCenterPoint = { x: data.x, y: data.y };
            
            // Center the canvas on this point
            const centerX = window.innerWidth / 2 - data.x;
            const centerY = window.innerHeight / 2 - data.y;
            canvas.viewportTransform = [1, 0, 0, 1, centerX, centerY];
            canvas.requestRenderAll();
            
            // Show indicator if admin
            if (isAdmin) {
                showCenterIndicator(data.x, data.y);
            }
        }
    } catch (error) {
        console.error('Error loading center point:', error);
    }
}

// Media Upload Functions
function addImage() {
    document.getElementById('fileInput').click();
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        console.log('No file selected');
        return;
    }
    
    console.log('File selected:', file.name, 'Size:', file.size, 'Type:', file.type);
    
    showLoading();
    
    try {
        // Upload file to Supabase Storage
        const fileName = `${Date.now()}_${file.name}`;
        console.log('Uploading file:', fileName);
        
        const { data, error } = await supabaseClient.storage
            .from('canvas-media')
            .upload(fileName, file);
        
        if (error) {
            console.error('Storage upload error:', error);
            throw error;
        }
        
        console.log('File uploaded successfully:', data);
        
        // Get public URL
        const { data: { publicUrl } } = supabaseClient.storage
            .from('canvas-media')
            .getPublicUrl(fileName);
        
        console.log('Public URL:', publicUrl);
        
        // Create image object on canvas
        addImageToCanvas(publicUrl);
        
    } catch (error) {
        console.error('Error uploading file:', error);
        showStatus('Error uploading file', 'error');
    } finally {
        hideLoading();
        event.target.value = ''; // Reset file input
    }
}

function addImageToCanvas(imageUrl) {
    console.log('Creating image from URL:', imageUrl);
    
    // Create a simple image element
    const imgElement = new Image();
    imgElement.onload = function() {
        console.log('Image loaded successfully, dimensions:', imgElement.width, 'x', imgElement.height);
        
        // Calculate aspect ratio and set height to 150px, width by aspect ratio
        const aspectRatio = imgElement.width / imgElement.height;
        const displayHeight = 150; // Fixed height
        const displayWidth = displayHeight * aspectRatio; // Width calculated by aspect ratio
        
        // Create a Fabric.js image from the loaded image element
        const fabricImg = new fabric.Image(imgElement, {
            left: canvasCenterPoint.x,
            top: canvasCenterPoint.y,
            originX: 'center',
            originY: 'center',
            lockUniScaling: true, // Maintain aspect ratio when scaling
            lockScalingFlip: true, // Prevent flipping
            centeredScaling: true, // Scale from center
            uniformScaling: true, // Force uniform scaling
            lockSkewingX: true, // Prevent X skewing
            lockSkewingY: true // Prevent Y skewing
        });
        
        // Set the dimensions after creation to ensure proper scaling
        fabricImg.scaleToHeight(displayHeight);
        
        // Apply styling to image
        applyImageStyling(fabricImg);
        
        // Add custom properties
        fabricImg.userId = userId;
        fabricImg.itemType = 'image';
        fabricImg.originalWidth = imgElement.width;
        fabricImg.originalHeight = imgElement.height;
        fabricImg.aspectRatio = aspectRatio;
        fabricImg.borderRadius = IMAGE_STYLING.borderRadius; // Default border radius for new images
        
        // Add event listeners for image updates
        fabricImg.on('modified', function() {
            console.log('New image modified event fired for:', fabricImg.customId);
            updateCanvasItem(fabricImg);
        });
        
        fabricImg.on('scaled', function() {
            console.log('New image scaled event fired for:', fabricImg.customId);
            updateCanvasItem(fabricImg);
        });
        
        fabricImg.on('moved', function() {
            console.log('New image moved event fired for:', fabricImg.customId);
            updateCanvasItem(fabricImg);
        });
        
        fabricImg.on('rotated', function() {
            console.log('New image rotated event fired for:', fabricImg.customId);
            updateCanvasItem(fabricImg);
        });
        
        console.log('Adding image to canvas with properties:', {
            userId: fabricImg.userId,
            itemType: fabricImg.itemType,
            width: fabricImg.width,
            height: fabricImg.height
        });
        
        canvas.add(fabricImg);
        canvas.setActiveObject(fabricImg);
        
        console.log('Image added to canvas. Canvas objects count:', canvas.getObjects().length);
        console.log('Active object:', canvas.getActiveObject());
        
        // Save to database and get the ID
        saveCanvasItem(fabricImg, imageUrl);
        
    };
    
    imgElement.onerror = function() {
        console.error('Error loading image from URL:', imageUrl);
        showStatus('Error loading image', 'error');
    };
    
    imgElement.src = imageUrl;
}

// Text Functions
function addTextDirectly() {
    const textObj = new fabric.Textbox('type something', {
        left: canvasCenterPoint.x,
        top: canvasCenterPoint.y,
        fontFamily: 'sans-serif',
        fontSize: 24,
        fontWeight: 'normal',
        fill: '#333333',
        lineHeight: 1.15,
        originX: 'center',
        originY: 'center',
        width: 450, // Set maximum width - this will enforce wrapping
        splitByGrapheme: false, // Don't break characters
        breakWords: false, // Don't break words
        dynamicMinWidth: 1 // Allow text to shrink when needed
    });
    
    // Add custom properties
    textObj.userId = userId;
    textObj.itemType = 'text';
    textObj.originalWidth = textObj.width;
    textObj.originalHeight = textObj.height;
    textObj.aspectRatio = textObj.width / textObj.height;
    
    // Add text change listener
    textObj.on('changed', function() {
        console.log('Text changed:', textObj.text);
        updateCanvasItem(textObj);
    });
    
    textObj.on('editing:exited', function() {
        console.log('Text editing exited:', textObj.text);
        updateCanvasItem(textObj);
    });
    
    canvas.add(textObj);
    canvas.setActiveObject(textObj);
    
    // Add user label
    addUserLabel(textObj);
    
    // Save to database and get the ID
    saveCanvasItem(textObj, 'type something');
    
    // Immediately enter editing mode and select all placeholder text
    textObj.enterEditing();
    textObj.selectAll();
}

// Legacy function kept for compatibility (used in HTML modal)
function addTextToCanvas() {
    const text = document.getElementById('textInput').value.trim();
    if (!text) return;
    
    const textObj = new fabric.Textbox(text, {
        left: canvasCenterPoint.x,
        top: canvasCenterPoint.y,
        fontFamily: 'sans-serif',
        fontSize: 24,
        fontWeight: 'normal',
        fill: '#333333',
        lineHeight: 1.15,
        originX: 'center',
        originY: 'center',
        width: 450,
        splitByGrapheme: false,
        breakWords: false,
        dynamicMinWidth: 1
    });
    
    textObj.userId = userId;
    textObj.itemType = 'text';
    textObj.originalWidth = textObj.width;
    textObj.originalHeight = textObj.height;
    textObj.aspectRatio = textObj.width / textObj.height;
    
    textObj.on('changed', function() {
        updateCanvasItem(textObj);
    });
    
    textObj.on('editing:exited', function() {
        updateCanvasItem(textObj);
    });
    
    canvas.add(textObj);
    canvas.setActiveObject(textObj);
    addUserLabel(textObj);
    saveCanvasItem(textObj, text);
    
    document.getElementById('textModal').classList.add('hidden');
    document.getElementById('textInput').value = '';
}

// HTML Functions
function showHtmlModal() {
    document.getElementById('htmlModal').classList.remove('hidden');
    document.getElementById('htmlInput').focus();
}

function closeHtmlModal() {
    document.getElementById('htmlModal').classList.add('hidden');
    document.getElementById('htmlInput').value = '';
    document.getElementById('htmlTitleInput').value = '';
}

function addHtmlToCanvas() {
    const htmlContent = document.getElementById('htmlInput').value.trim();
    const title = document.getElementById('htmlTitleInput').value.trim() || 'HTML Demo';
    
    if (!htmlContent) {
        alert('Please enter HTML content');
        return;
    }
    
    // Create iframe element with srcdoc for embedded HTML
    const iframeElement = document.createElement('iframe');
    iframeElement.srcdoc = htmlContent; // Use srcdoc instead of src for embedded HTML
    iframeElement.width = 400;
    iframeElement.height = 300;
    iframeElement.frameBorder = '0';
    iframeElement.allowFullscreen = true;
    iframeElement.style.borderRadius = '12px';
    iframeElement.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.2)';
    iframeElement.style.border = '2px solid #ddd';
    iframeElement.style.pointerEvents = 'none'; // Disabled by default, enabled in interaction mode
    
    // Create Fabric.js object to hold the iframe (with free resize - no aspect ratio lock)
    const htmlObj = new fabric.Rect({
        left: canvasCenterPoint.x,
        top: canvasCenterPoint.y,
        width: 400,
        height: 300,
        fill: 'rgba(240, 248, 255, 0.1)', // Light blue tint to indicate HTML content
        stroke: '#667eea', // Blue border to match theme
        strokeWidth: 2,
        strokeDashArray: [8, 4], // Dashed border to indicate special content type
        rx: 12,
        ry: 12,
        originX: 'center',
        originY: 'center',
        lockUniScaling: false, // Allow free resizing
        uniformScaling: false, // Disable uniform scaling
        selectable: false, // Only selectable via label click
        evented: false // Events handled by label
    });
    
    // Add custom properties
    htmlObj.customId = 'html_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    htmlObj.userId = userId;
    htmlObj.itemType = 'html';
    htmlObj.htmlContent = htmlContent;
    htmlObj.htmlTitle = title;
    htmlObj.originalWidth = 400;
    htmlObj.originalHeight = 300;
    htmlObj.aspectRatio = 400 / 300;
    
    // Store iframe element reference
    htmlObj.iframeElement = iframeElement;
    htmlObj.interactionMode = false; // Start in container mode
    
    
    canvas.add(htmlObj);
    canvas.setActiveObject(htmlObj);
    
    // Position iframe element over canvas object
    positionHtmlElement(htmlObj);
    
    // Add user label
    addUserLabel(htmlObj);
    
    // Save to database
    saveCanvasItem(htmlObj, htmlContent);
    
    closeHtmlModal();
}

function positionHtmlElement(htmlObj) {
    if (!htmlObj.iframeElement || !canvas) return;
    
    const canvasEl = canvas.getElement();
    if (!canvasEl) return;
    
    const canvasRect = canvasEl.getBoundingClientRect();
    // Skip if canvas hasn't been sized yet
    if (canvasRect.width === 0 || canvasRect.height === 0) {
        setTimeout(() => positionHtmlElement(htmlObj), 100);
        return;
    }
    
    const zoom = canvas.getZoom();
    const vpt = canvas.viewportTransform;
    
    // Calculate screen position
    const objLeft = htmlObj.left * zoom + vpt[4] + canvasRect.left;
    const objTop = htmlObj.top * zoom + vpt[5] + canvasRect.top;
    const objWidth = htmlObj.width * zoom * (htmlObj.scaleX || 1);
    const objHeight = htmlObj.height * zoom * (htmlObj.scaleY || 1);
    const rotation = htmlObj.angle || 0;
    
    // Position iframe element
    htmlObj.iframeElement.style.position = 'fixed';
    htmlObj.iframeElement.style.left = (objLeft - objWidth/2) + 'px';
    htmlObj.iframeElement.style.top = (objTop - objHeight/2) + 'px';
    htmlObj.iframeElement.style.width = objWidth + 'px';
    htmlObj.iframeElement.style.height = objHeight + 'px';
    
    // Set z-index based on canvas object order
    const objectIndex = canvas.getObjects().indexOf(htmlObj);
    htmlObj.iframeElement.style.zIndex = (1000 + objectIndex).toString();
    
    // Set pointer events - always allow clicks but block iframe content interaction unless in interaction mode
    if (htmlObj.interactionMode) {
        htmlObj.iframeElement.style.pointerEvents = 'all';
        // Hide overlay in interaction mode
        if (htmlObj.clickOverlay) {
            htmlObj.clickOverlay.style.display = 'none';
        }
    } else {
        // Allow clicks but not iframe content interaction
        htmlObj.iframeElement.style.pointerEvents = 'all';
        // Add overlay to block iframe content but allow our click handler
        if (!htmlObj.clickOverlay) {
            const overlay = document.createElement('div');
            overlay.style.position = 'absolute';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.background = 'transparent';
            overlay.style.zIndex = '10';
            overlay.style.pointerEvents = 'all';
            
            htmlObj.iframeElement.style.position = 'relative';
            htmlObj.iframeElement.appendChild(overlay);
            htmlObj.clickOverlay = overlay;
            
            overlay.addEventListener('click', function(e) {
                if (!htmlObj.interactionMode && (htmlObj.userId === userId || isAdmin)) {
                    e.preventDefault();
                    e.stopPropagation();
                    enterHtmlInteractionMode(htmlObj);
                }
            });
        }
        htmlObj.clickOverlay.style.display = 'block';
    }
    
    // Apply rotation transform
    htmlObj.iframeElement.style.transformOrigin = 'center center';
    htmlObj.iframeElement.style.transform = `rotate(${rotation}deg)`;
    
    // Add to document if not already added
    if (!document.body.contains(htmlObj.iframeElement)) {
        document.body.appendChild(htmlObj.iframeElement);
        
        // Add click handler to iframe for entering interaction mode
        htmlObj.iframeElement.addEventListener('click', function(e) {
            if (!htmlObj.interactionMode && (htmlObj.userId === userId || isAdmin)) {
                e.preventDefault();
                e.stopPropagation();
                enterHtmlInteractionMode(htmlObj);
            }
        });
    }
}

// Database Functions
async function saveCanvasItem(fabricObject, content) {
    try {
        const insertData = {
            x: fabricObject.left,
            y: fabricObject.top,
            item_type: fabricObject.itemType,
            content: content,
            user_id: userId,
            width: fabricObject.width,
            height: fabricObject.height,
            original_width: fabricObject.originalWidth || fabricObject.width,
            original_height: fabricObject.originalHeight || fabricObject.height,
            aspect_ratio: fabricObject.aspectRatio || 1,
            rotation: fabricObject.angle || 0,
            z_index: canvas.getObjects().indexOf(fabricObject),
            border_radius: fabricObject.borderRadius || (fabricObject.itemType === 'image' ? IMAGE_STYLING.borderRadius : 0)
        };
        
        // Add text-specific properties if this is a text object
        if (fabricObject.itemType === 'text') {
            insertData.font_family = fabricObject.fontFamily || 'sans-serif';
            insertData.font_size = fabricObject.fontSize || 24;
            insertData.font_weight = fabricObject.fontWeight || 'normal';
            insertData.text_color = fabricObject.fill || '#333333';
            insertData.line_height = fabricObject.lineHeight || 1.15;
        }
        
        // Add HTML-specific properties if this is an HTML object
        if (fabricObject.itemType === 'html') {
            insertData.html_content = fabricObject.htmlContent; // Save HTML content to html_content field
            insertData.content = fabricObject.htmlTitle || 'HTML Demo'; // Save title to content field
        }
        
        console.log('Attempting to save item with data:', insertData);
        
        const { data, error } = await supabaseClient
            .from('canvas_items')
            .insert(insertData)
            .select()
            .single();
        
        if (error) {
            console.error('Supabase insert error:', error);
            throw error;
        }
        
        console.log('Item saved successfully:', data);
        
        // Update the fabric object with the database ID
        fabricObject.customId = data.id;
        
        return data.id;
        
    } catch (error) {
        console.error('Error saving item:', error);
        showStatus('Error saving item', 'error');
        return null;
    }
}

async function updateCanvasItem(fabricObject) {
    if (!fabricObject.customId) {
        console.log('No customId found for object:', fabricObject);
        return;
    }
    
    try {
        // Get the correct content based on object type
        let content = '';
        if (fabricObject.itemType === 'text') {
            content = fabricObject.text || '';
        } else if (fabricObject.itemType === 'image') {
            content = fabricObject.getSrc ? fabricObject.getSrc() : '';
        }
        
        const updateData = {
            x: fabricObject.left,
            y: fabricObject.top,
            width: fabricObject.width * (fabricObject.scaleX || 1),
            height: fabricObject.height * (fabricObject.scaleY || 1),
            original_width: fabricObject.originalWidth || fabricObject.width * (fabricObject.scaleX || 1),
            original_height: fabricObject.originalHeight || fabricObject.height * (fabricObject.scaleY || 1),
            aspect_ratio: fabricObject.aspectRatio || 1,
            rotation: fabricObject.angle || 0,
            z_index: canvas.getObjects().indexOf(fabricObject),
            content: content,
            border_radius: fabricObject.borderRadius || (fabricObject.itemType === 'image' ? IMAGE_STYLING.borderRadius : 0)
        };
        
        // Add text-specific properties if this is a text object
        if (fabricObject.itemType === 'text') {
            updateData.font_family = fabricObject.fontFamily || 'sans-serif';
            updateData.font_size = fabricObject.fontSize || 24;
            updateData.font_weight = fabricObject.fontWeight || 'normal';
            updateData.text_color = fabricObject.fill || '#333333';
            updateData.line_height = fabricObject.lineHeight || 1.15;
        }
        
        // Add HTML-specific properties if this is an HTML object
        if (fabricObject.itemType === 'html') {
            updateData.html_content = fabricObject.htmlContent; // Update HTML content
            updateData.content = fabricObject.htmlTitle || 'HTML Demo'; // Update title
        }
        
        console.log('Updating item with data:', {
            id: fabricObject.customId,
            type: fabricObject.itemType,
            updateData: updateData
        });
        
        const { error } = await supabaseClient
            .from('canvas_items')
            .update(updateData)
            .eq('id', fabricObject.customId);
        
        if (error) {
            console.error('Supabase update error:', error);
            console.error('Error details:', JSON.stringify(error, null, 2));
            throw error;
        }
        
        console.log('Item updated successfully in Supabase');
        
        // Re-apply styling for images to ensure it's preserved
        if (fabricObject.itemType === 'image') {
            setTimeout(() => {
                applyImageStyling(fabricObject);
            }, 50);
        }
        
    } catch (error) {
        console.error('Error updating item:', error);
    }
}

async function loadCanvasItems() {
    console.log('Loading canvas items...');
    showLoading();
    
    try {
        const { data, error } = await supabaseClient
            .from('canvas_items')
            .select('*')
            .order('z_index', { ascending: true });
        
        if (error) throw error;
        
        console.log('Canvas items loaded from database:', data.length);
        
        // Clear existing objects (except center indicator)
        canvas.getObjects().forEach(obj => {
            if (obj !== centerIndicator) {
                canvas.remove(obj);
            }
        });
        
        // Add items to canvas
        for (const item of data) {
            await addItemToCanvas(item);
        }
        
        console.log('Canvas items loading complete');
        
        // Position all HTML elements after canvas items are loaded
        setTimeout(() => {
            updateHtmlElementPositions();
        }, 100);
        
        // Force update all image styling to ensure consistency
        setTimeout(() => {
            console.log('Forcing update of all image styling...');
            updateAllImageStyling();
            // Also fix label z-indexes after loading
            updateAllLabelZIndexes();
        }, 1000);
        
    } catch (error) {
        console.error('Error loading items:', error);
        showStatus('Error loading canvas items', 'error');
    } finally {
        hideLoading();
    }
}

async function addItemToCanvas(item) {
    return new Promise((resolve) => {
        if (item.item_type === 'image') {
            // Check if the content is a blob URL (which will be invalid)
            if (item.content && item.content.startsWith('blob:')) {
                console.log('Skipping invalid blob URL:', item.content);
                resolve();
                return;
            }
            
            // Create a simple image element
            const imgElement = new Image();
            imgElement.onload = function() {
                console.log('Loading existing image from URL:', item.content);
                
                // Create Fabric.js image from the loaded image element
                const fabricImg = new fabric.Image(imgElement, {
                    left: item.x,
                    top: item.y,
                    originX: 'center',
                    originY: 'center',
                    angle: item.rotation,
                    lockUniScaling: true, // Maintain aspect ratio when scaling
                    lockScalingFlip: true, // Prevent flipping
                    centeredScaling: true, // Scale from center
                    uniformScaling: true, // Force uniform scaling
                    lockSkewingX: true, // Prevent X skewing
                    lockSkewingY: true // Prevent Y skewing
                });
                
                // Use scaleX and scaleY to maintain aspect ratio instead of width/height
                if (item.width && item.height && item.original_width && item.original_height) {
                    const scaleX = item.width / item.original_width;
                    const scaleY = item.height / item.original_height;
                    fabricImg.set({
                        scaleX: scaleX,
                        scaleY: scaleY
                    });
                }
                
                // Add custom properties
                fabricImg.customId = item.id;
                fabricImg.userId = item.user_id;
                fabricImg.itemType = item.item_type;
                fabricImg.originalWidth = item.original_width;
                fabricImg.originalHeight = item.original_height;
                fabricImg.aspectRatio = item.aspect_ratio;
                fabricImg.borderRadius = (item.border_radius !== undefined && item.border_radius !== null) ? item.border_radius : IMAGE_STYLING.borderRadius; // Load per-image border radius
                
                // Apply styling to image after properties are set
                console.log('Applying styling to loaded image:', fabricImg.customId);
                applyImageStyling(fabricImg);
                
                // Add event listeners for image updates
                fabricImg.on('modified', function() {
                    console.log('Image modified event fired for:', fabricImg.customId);
                    updateCanvasItem(fabricImg);
                });
                
                fabricImg.on('scaled', function() {
                    console.log('Image scaled event fired for:', fabricImg.customId);
                    updateCanvasItem(fabricImg);
                });
                
                fabricImg.on('moved', function() {
                    console.log('Image moved event fired for:', fabricImg.customId);
                    updateCanvasItem(fabricImg);
                });
                
                fabricImg.on('rotated', function() {
                    console.log('Image rotated event fired for:', fabricImg.customId);
                    updateCanvasItem(fabricImg);
                });
                
                // If no ID exists (old data), create a new record
                if (!item.id) {
                    console.log('Image has no ID, creating new record...');
                    saveCanvasItem(fabricImg, item.content);
                }
                
                console.log('Loaded image object with customId:', fabricImg.customId, 'full item:', item);
                
                canvas.add(fabricImg);
                resolve();
            };
            
            imgElement.onerror = function() {
                console.error('Error loading existing image from URL:', item.content);
                resolve(); // Continue loading other items
            };
            
            imgElement.src = item.content;
        } else if (item.item_type === 'text') {
            const textObj = new fabric.Textbox(item.content, {
                left: item.x,
                top: item.y,
                width: Math.min(item.width || 450, 450), // Enforce max width of 450px - this will enforce wrapping
                height: item.height,
                angle: item.rotation,
                fontSize: item.font_size || 24,
                fontFamily: item.font_family || 'sans-serif',
                fontWeight: item.font_weight || 'normal',
                fill: item.text_color || '#333333',
                lineHeight: item.line_height || 1.15,
                splitByGrapheme: false, // Don't break characters
                breakWords: false, // Don't break words
                dynamicMinWidth: 1, // Allow text to shrink when needed
                originX: 'center',
                originY: 'center'
            });
            
            // Add custom properties
            textObj.customId = item.id;
            textObj.userId = item.user_id;
            textObj.itemType = item.item_type;
            textObj.originalWidth = item.original_width;
            textObj.originalHeight = item.original_height;
            textObj.aspectRatio = item.aspect_ratio;
            
            // If no ID exists (old data), create a new record
            if (!item.id) {
                console.log('Item has no ID, creating new record...');
                saveCanvasItem(textObj, item.content);
            }
            
            console.log('Loaded text object with customId:', textObj.customId, 'content:', item.content, 'full item:', item);
            
                    // Add text change listeners for existing text
            textObj.on('changed', function() {
                console.log('Existing text changed:', textObj.text);
                updateCanvasItem(textObj);
            });
            
            textObj.on('editing:exited', function() {
                console.log('Existing text editing exited:', textObj.text);
                updateCanvasItem(textObj);
            });
            
            canvas.add(textObj);
            
            // Add user label for existing text objects
            addUserLabel(textObj);
            
            resolve();
        } else if (item.item_type === 'html') {
            // Create iframe element with srcdoc for embedded HTML
            const iframeElement = document.createElement('iframe');
            iframeElement.srcdoc = item.html_content; // Use html_content field for HTML content
            iframeElement.width = item.width || 400;
            iframeElement.height = item.height || 300;
            iframeElement.frameBorder = '0';
            iframeElement.allowFullscreen = true;
            iframeElement.style.borderRadius = '12px';
            iframeElement.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.2)';
            iframeElement.style.border = '2px solid #ddd';
            iframeElement.style.pointerEvents = 'none'; // Disabled by default, enabled in interaction mode
            
            // Create Fabric.js rectangle to represent HTML (with free resize)
            const htmlObj = new fabric.Rect({
                left: item.x,
                top: item.y,
                width: item.width || 400,
                height: item.height || 300,
                fill: 'rgba(240, 248, 255, 0.1)', // Light blue tint to indicate HTML content
                stroke: '#667eea', // Blue border to match theme
                strokeWidth: 2,
                strokeDashArray: [8, 4], // Dashed border to indicate special content type
                rx: 12,
                ry: 12,
                originX: 'center',
                originY: 'center',
                angle: item.rotation,
                lockUniScaling: false, // Allow free resizing
                uniformScaling: false, // Disable uniform scaling
                selectable: false, // Only selectable via label click
                evented: false // Events handled by label
            });
            
            // Add custom properties
            htmlObj.customId = item.id;
            htmlObj.userId = item.user_id;
            htmlObj.itemType = item.item_type;
            htmlObj.htmlContent = item.html_content; // Load HTML content from html_content field
            htmlObj.htmlTitle = item.content || 'HTML Demo'; // Load title from content field
            htmlObj.originalWidth = item.original_width;
            htmlObj.originalHeight = item.original_height;
            htmlObj.aspectRatio = item.aspect_ratio;
            htmlObj.iframeElement = iframeElement;
            htmlObj.interactionMode = false; // Start in container mode
            
            
            canvas.add(htmlObj);
            
            // Add user label
            addUserLabel(htmlObj);
            
            // Position iframe element after a short delay to ensure canvas is ready
            setTimeout(() => {
                positionHtmlElement(htmlObj);
            }, 50);
            
            console.log('Loaded HTML object with customId:', htmlObj.customId);
            
            resolve();
        }
    });
}

// Permissions
function checkObjectPermissions(obj) {
    if (!obj) return;
    
    // Admin can manipulate everything
    if (isAdmin) {
        obj.selectable = true;
        obj.evented = true;
        return;
    }
    
    // Users can only manipulate their own objects
    if (obj.userId === userId) {
        obj.selectable = true;
        obj.evented = true;
    } else {
        obj.selectable = false;
        obj.evented = false;
        canvas.discardActiveObject();
        showStatus('You can only edit your own items', 'error');
    }
}

// Clear Canvas (Admin Only)
async function clearCanvas() {
    if (!isAdmin) return;
    
    if (confirm('Are you sure you want to clear the entire canvas? This cannot be undone.')) {
        try {
            // Delete from database
            const { error } = await supabaseClient
                .from('canvas_items')
                .delete()
                .neq('id', 0); // Delete all items
            
            if (error) throw error;
            
            // Clear canvas
            canvas.getObjects().forEach(obj => {
                if (obj !== centerIndicator) {
                    canvas.remove(obj);
                }
            });
            
            // showStatus('Canvas cleared', 'success');
            
        } catch (error) {
            console.error('Error clearing canvas:', error);
            showStatus('Error clearing canvas', 'error');
        }
    }
}

// Real-time Subscriptions
function setupRealtime() {
    // Listen for new canvas items
    supabaseClient
        .channel('canvas_items')
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'canvas_items' },
            (payload) => {
                if (payload.new.user_id !== userId) {
                    addItemToCanvas(payload.new);
                }
            }
        )
        .on('postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'canvas_items' },
            (payload) => {
                if (payload.new.user_id !== userId) {
                    updateExistingItem(payload.new);
                }
            }
        )
        .on('postgres_changes',
            { event: 'DELETE', schema: 'public', table: 'canvas_items' },
            (payload) => {
                removeItemFromCanvas(payload.old.id);
            }
        )
        .subscribe();
    
    // Listen for center point changes
    supabaseClient
        .channel('canvas_center')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'canvas_center' },
            (payload) => {
                if (payload.new) {
                    loadCenterPoint();
                }
            }
        )
        .subscribe();
}

function updateExistingItem(itemData) {
    const objects = canvas.getObjects();
    const existingObj = objects.find(obj => obj.customId === itemData.id);
    
    if (existingObj) {
        // For images, use scaleX and scaleY to maintain aspect ratio
        if (existingObj.itemType === 'image' && itemData.original_width && itemData.original_height) {
            const scaleX = itemData.width / itemData.original_width;
            const scaleY = itemData.height / itemData.original_height;
            
            existingObj.set({
                left: itemData.x,
                top: itemData.y,
                scaleX: scaleX,
                scaleY: scaleY,
                angle: itemData.rotation
            });
        } else {
            // For text and other objects, use width and height
            existingObj.set({
                left: itemData.x,
                top: itemData.y,
                width: itemData.width,
                height: itemData.height,
                angle: itemData.rotation
            });
        }
        canvas.requestRenderAll();
    }
}

function removeItemFromCanvas(itemId) {
    const objects = canvas.getObjects();
    const objToRemove = objects.find(obj => obj.customId === itemId);
    
    if (objToRemove) {
        // Remove user label if it exists
        if (objToRemove.userLabel) {
            canvas.remove(objToRemove.userLabel);
        }
        canvas.remove(objToRemove);
    }
}

// Utility Functions
function showLoading() {
    console.log('Showing loading indicator');
    document.getElementById('loadingIndicator').classList.remove('hidden');
}

function hideLoading() {
    console.log('Hiding loading indicator');
    document.getElementById('loadingIndicator').classList.add('hidden');
}

// Z-Index Controls
function toggleZIndexControls(show) {
    const zIndexControls = document.getElementById('zIndexControls');
    if (show) {
        zIndexControls.style.display = 'flex';
    } else {
        zIndexControls.style.display = 'none';
    }
}

function toggleBorderRadiusControls(selectedObject) {
    const borderRadiusControls = document.getElementById('borderRadiusControls');
    const borderRadiusInput = document.getElementById('borderRadiusInput');
    
    if (selectedObject && selectedObject.itemType === 'image') {
        // Show controls for images only
        borderRadiusControls.style.display = 'flex';
        // Set the input value to the current border radius
        borderRadiusInput.value = selectedObject.borderRadius || 0;
    } else {
        // Hide controls for non-images or when nothing is selected
        borderRadiusControls.style.display = 'none';
    }
}

function toggleTextControls(selectedObject) {
    const textControls = document.getElementById('textControls');
    
    if (selectedObject && selectedObject.itemType === 'text') {
        // Show controls for text objects only
        textControls.style.display = 'flex';
        
        // Update control values to match selected text object
        document.getElementById('fontFamilySelect').value = selectedObject.fontFamily || 'sans-serif';
        document.getElementById('fontSizeInput').value = selectedObject.fontSize || 24;
        document.getElementById('fontWeightSelect').value = selectedObject.fontWeight || 'normal';
        document.getElementById('textColorInput').value = selectedObject.fill || '#333333';
        document.getElementById('lineHeightInput').value = selectedObject.lineHeight || 1.15;
    } else {
        // Hide controls for non-text objects or when nothing is selected
        textControls.style.display = 'none';
    }
}

function updateBorderRadius() {
    const activeObject = canvas.getActiveObject();
    const borderRadiusInput = document.getElementById('borderRadiusInput');
    
    if (activeObject && activeObject.itemType === 'image') {
        const newRadius = parseInt(borderRadiusInput.value) || 0;
        activeObject.borderRadius = newRadius;
        
        // Re-apply styling with the new border radius
        applyImageStyling(activeObject);
        canvas.requestRenderAll();
        
        // Save the change to the database
        updateCanvasItem(activeObject);
    }
}

function updateTextProperty() {
    const activeObject = canvas.getActiveObject();
    
    if (activeObject && activeObject.itemType === 'text') {
        // Get current values from controls
        const fontFamily = document.getElementById('fontFamilySelect').value;
        const fontSize = parseInt(document.getElementById('fontSizeInput').value) || 24;
        const fontWeight = document.getElementById('fontWeightSelect').value;
        const textColor = document.getElementById('textColorInput').value;
        const lineHeight = parseFloat(document.getElementById('lineHeightInput').value) || 1.2;
        
        // Update the text object properties
        activeObject.set({
            fontFamily: fontFamily,
            fontSize: fontSize,
            fontWeight: fontWeight,
            fill: textColor,
            lineHeight: lineHeight
        });
        
        // Update the label position in case text dimensions changed
        if (activeObject.userLabel) {
            updateUserLabelPosition(activeObject, activeObject.userLabel);
        }
        
        canvas.requestRenderAll();
        
        // Save the change to the database
        updateCanvasItem(activeObject);
    }
}

function bringToFront() {
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
        canvas.bringObjectToFront(activeObject);
        
        // If this object has a label, bring it to front too (right after the object)
        if (activeObject.userLabel) {
            canvas.bringObjectToFront(activeObject.userLabel);
        }
        
        // Update all objects to ensure z-index is correct
        canvas.getObjects().forEach((obj, index) => {
            if (obj.customId) {
                updateCanvasItem(obj);
                // Update HTML iframe position after z-index change
                if (obj.itemType === 'html') {
                    positionHtmlElement(obj);
                }
            }
        });
        // showStatus('Brought to front', 'success');
    }
}

function sendToBack() {
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
        canvas.sendObjectToBack(activeObject);
        
        // If this object has a label, position it right after the object
        if (activeObject.userLabel) {
            const objectIndex = canvas.getObjects().indexOf(activeObject);
            canvas.moveObjectTo(activeObject.userLabel, objectIndex + 1);
        }
        
        // Update all objects to ensure z-index is correct
        canvas.getObjects().forEach((obj, index) => {
            if (obj.customId) {
                updateCanvasItem(obj);
                // Update HTML iframe position after z-index change
                if (obj.itemType === 'html') {
                    positionHtmlElement(obj);
                }
            }
        });
        // showStatus('Sent to back', 'success');
    }
}

// Image styling functions
function applyImageStyling(fabricImg) {
    console.log('Applying image styling with settings:', IMAGE_STYLING);
    
    // Apply shadow
    fabricImg.set({
        shadow: new fabric.Shadow({
            color: IMAGE_STYLING.shadowColor,
            blur: IMAGE_STYLING.shadowBlur,
            offsetX: IMAGE_STYLING.shadowOffsetX,
            offsetY: IMAGE_STYLING.shadowOffsetY
        })
    });
    
    // Apply rounded corners using clipPath that matches image dimensions exactly
    const borderRadius = (fabricImg.borderRadius !== undefined && fabricImg.borderRadius !== null) ? fabricImg.borderRadius : IMAGE_STYLING.borderRadius;
    if (borderRadius > 0) {
        // Use the image's natural width and height (before any scaling)
        const imageWidth = fabricImg.width;
        const imageHeight = fabricImg.height;
        
        const clipPath = new fabric.Rect({
            width: imageWidth,
            height: imageHeight,
            rx: borderRadius,
            ry: borderRadius,
            originX: 'center',
            originY: 'center'
        });
        
        fabricImg.set({
            clipPath: clipPath
        });
    } else {
        // Remove clipPath when borderRadius is 0
        fabricImg.set({
            clipPath: null
        });
    }
    
    console.log('Image styling applied successfully');
    
    // Add user label
    addUserLabel(fabricImg);
}

function updateAllImageStyling() {
    const objects = canvas.getObjects();
    objects.forEach(obj => {
        if (obj.itemType === 'image') {
            applyImageStyling(obj);
        }
    });
    canvas.requestRenderAll();
    // showStatus('Updated all image styling', 'success');
}

function updateAllLabelZIndexes() {
    const objects = canvas.getObjects();
    objects.forEach(obj => {
        if (obj.userLabel && obj.itemType) {
            // Position label right after its parent object
            const parentIndex = objects.indexOf(obj);
            if (parentIndex !== -1) {
                canvas.moveObjectTo(obj.userLabel, parentIndex + 1);
            }
        }
    });
    canvas.requestRenderAll();
}

function addUserLabel(fabricObject) {
    // Remove existing label if it exists
    if (fabricObject.userLabel) {
        canvas.remove(fabricObject.userLabel);
    }
    
    // Only add labels to images, text, and HTML objects
    if (!fabricObject.itemType || (fabricObject.itemType !== 'image' && fabricObject.itemType !== 'text' && fabricObject.itemType !== 'html')) {
        return;
    }
    
    // Get the user name (stored in userId now)
    const userName = fabricObject.userId || 'Unknown';
    
    // Choose background color based on ownership
    const backgroundColor = (fabricObject.userId === userId) ? 
        LABEL_STYLING.ownItemBackgroundColor : 
        LABEL_STYLING.backgroundColor;
    
    // Create text element (no background)
    const textElement = new fabric.Text(userName, {
        fontSize: LABEL_STYLING.fontSize,
        fontFamily: LABEL_STYLING.fontFamily,
        fill: LABEL_STYLING.textColor,
        selectable: false,
        evented: false,
        excludeFromExport: true,
        originX: 'center',
        originY: 'center'
    });
    
    // Create rounded rectangle background with separate padding
    const backgroundWidth = textElement.width + (LABEL_STYLING.paddingHorizontal * 2);
    const backgroundHeight = textElement.height + (LABEL_STYLING.paddingVertical * 2);
    
    const background = new fabric.Rect({
        width: backgroundWidth,
        height: backgroundHeight,
        fill: backgroundColor,
        rx: LABEL_STYLING.borderRadius,
        ry: LABEL_STYLING.borderRadius,
        selectable: false,
        evented: false,
        excludeFromExport: true,
        originX: 'center',
        originY: 'center'
    });
    
    // Create a group with background and text
    const labelGroup = new fabric.Group([background, textElement], {
        selectable: true,  // Make label selectable
        evented: true,     // Allow events on label
        excludeFromExport: true,
        originX: 'left',
        originY: 'bottom',
        hasControls: false, // Hide resize/rotate controls
        hasBorders: false   // Hide selection border for cleaner look
    });
    
    // Store reference to parent object on the label
    labelGroup.parentObject = fabricObject;
    
    // Position the label group
    updateUserLabelPosition(fabricObject, labelGroup);
    
    // Store reference to label group on the object
    fabricObject.userLabel = labelGroup;
    
    // Add label to canvas
    canvas.add(labelGroup);
    
    // Position label right after its parent object in the stack
    const parentIndex = canvas.getObjects().indexOf(fabricObject);
    if (parentIndex !== -1) {
        canvas.moveObjectTo(labelGroup, parentIndex + 1);
    }
    
    // Make label follow the object transformations
    attachLabelToObject(fabricObject, labelGroup);
    
    // Special handling for HTML object labels
    if (fabricObject.itemType === 'html') {
        // Handle label click to select HTML container
        labelGroup.on('mousedown', function(e) {
            e.e.preventDefault();
            e.e.stopPropagation();
            
            // Only allow selection if user owns the object or is admin
            if (fabricObject.userId === userId || isAdmin) {
                // Exit interaction mode if active
                if (fabricObject.interactionMode) {
                    exitHtmlInteractionMode(fabricObject);
                }
                
                // Select the HTML container
                fabricObject.selectable = true;
                fabricObject.evented = true;
                canvas.setActiveObject(fabricObject);
                canvas.renderAll();
            }
        });
    }
}

function updateUserLabelPosition(fabricObject, label) {
    let objectWidth, objectHeight;
    
    // Now that text has a consistent max width, we can use scaling factors for both types
    // This makes label positioning more predictable and consistent
    if (fabricObject.itemType === 'text') {
        // For text objects with constrained width, use width/height with scaling factors
        // This gives us predictable positioning even when text is scaled
        objectWidth = fabricObject.width * (fabricObject.scaleX || 1);
        objectHeight = fabricObject.height * (fabricObject.scaleY || 1);
    } else {
        // For images and other objects, continue using width/height with scaling factors
        objectWidth = fabricObject.width * (fabricObject.scaleX || 1);
        objectHeight = fabricObject.height * (fabricObject.scaleY || 1);
    }
    
    // Position label above the top-left corner in local coordinates
    const localOffsetX = -objectWidth / 2; // Left edge relative to center
    const localOffsetY = -objectHeight / 2 - LABEL_STYLING.offsetY; // Above by offsetY pixels
    
    // Transform the local offset to world coordinates using object's transform
    const angle = fabricObject.angle || 0;
    const cosAngle = Math.cos(fabric.util.degreesToRadians(angle));
    const sinAngle = Math.sin(fabric.util.degreesToRadians(angle));
    
    const worldOffsetX = localOffsetX * cosAngle - localOffsetY * sinAngle;
    const worldOffsetY = localOffsetX * sinAngle + localOffsetY * cosAngle;
    
    // Position label relative to object center with rotation
    label.set({
        left: fabricObject.left + worldOffsetX,
        top: fabricObject.top + worldOffsetY,
        angle: angle // Rotate with the object
    });
}

function attachLabelToObject(fabricObject, label) {
    // Store original setCoords method
    const originalSetCoords = fabricObject.setCoords;
    
    // Override setCoords to update label position whenever object changes
    fabricObject.setCoords = function() {
        if (originalSetCoords) originalSetCoords.call(this);
        if (this.userLabel) {
            updateUserLabelPosition(this, this.userLabel);
            this.userLabel.setCoords();
        }
    };
}

function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
    statusEl.classList.remove('hidden');
    
    setTimeout(() => {
        statusEl.classList.add('hidden');
    }, 3000);
}

// Keyboard Shortcuts
document.addEventListener('keydown', function(e) {
    // Check if user is currently typing in an input field, textarea, or editing text
    const isTyping = document.activeElement && (
        document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA' ||
        document.activeElement.contentEditable === 'true'
    );
    
    // Check if user is editing text on canvas
    const activeObj = canvas.getActiveObject();
    const isEditingText = activeObj && activeObj.itemType === 'text' && activeObj.isEditing;
    
    // Delete selected object (if user owns it or is admin) - but only if not typing or editing
    if (e.key === 'Delete' || e.key === 'Backspace') {
        // Don't delete if user is typing or editing text
        if (isTyping || isEditingText) {
            return; // Let the normal delete/backspace behavior happen
        }
        
        // Only delete canvas objects when nothing is being edited
        if (activeObj && (activeObj.userId === userId || isAdmin)) {
            e.preventDefault(); // Prevent default only when we're deleting canvas objects
            deleteCanvasItem(activeObj);
        }
    }
    
    // Escape to cancel center setting or exit text editing
    if (e.key === 'Escape') {
        if (isSettingCenter) {
            toggleSetCenter();
        } else if (isEditingText) {
            activeObj.exitEditing();
            canvas.requestRenderAll();
        }
    }
    
    // Arrow key movement for selected objects (if not typing or editing text)
    if (!isTyping && !isEditingText && activeObj && (activeObj.userId === userId || isAdmin)) {
        let moved = false;
        const moveDistance = e.shiftKey ? 10 : 1; // Hold Shift for faster movement
        
        switch(e.key) {
            case 'ArrowUp':
                activeObj.top -= moveDistance;
                moved = true;
                break;
            case 'ArrowDown':
                activeObj.top += moveDistance;
                moved = true;
                break;
            case 'ArrowLeft':
                activeObj.left -= moveDistance;
                moved = true;
                break;
            case 'ArrowRight':
                activeObj.left += moveDistance;
                moved = true;
                break;
        }
        
        if (moved) {
            e.preventDefault();
            activeObj.setCoords();
            
            // Update HTML iframe position if it's an HTML object
            if (activeObj.itemType === 'html') {
                positionHtmlElement(activeObj);
            }
            
            // Update user label position
            if (activeObj.userLabel) {
                updateUserLabelPosition(activeObj, activeObj.userLabel);
            }
            
            canvas.renderAll();
            updateCanvasItem(activeObj);
        }
    }
});

async function deleteCanvasItem(fabricObject) {
    if (!fabricObject.customId) return;
    
    try {
        const { error } = await supabaseClient
            .from('canvas_items')
            .delete()
            .eq('id', fabricObject.customId);
        
        if (error) throw error;
        
        // Remove user label if it exists
        if (fabricObject.userLabel) {
            canvas.remove(fabricObject.userLabel);
        }
        
        // Remove HTML iframe element if it exists
        if (fabricObject.itemType === 'html' && fabricObject.iframeElement) {
            document.body.removeChild(fabricObject.iframeElement);
        }
        
        canvas.remove(fabricObject);
        // showStatus('Item deleted', 'success');
        
    } catch (error) {
        console.error('Error deleting item:', error);
        showStatus('Error deleting item', 'error');
    }
}

// Handle text modal enter key
document.getElementById('textInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        addTextToCanvas();
    }
});

// Handle admin modal enter key
document.getElementById('adminPassword').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        checkAdminPassword();
    }
});

// Handle user modal enter key
document.getElementById('userNickname').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        setUserNickname();
    }
});