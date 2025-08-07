// Item creation module
// Handles creation of all canvas item types (images, videos, text, code)

function addImage() {
    document.getElementById('fileInput').click();
}

async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check if it's a video or image
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    
    if (!isVideo && !isImage) {
        AppGlobals.showStatus('Please select an image or video file');
        return;
    }
    
    try {
        AppGlobals.showStatus(`Uploading ${isVideo ? 'video' : 'image'}...`);
        
        // Generate unique filename
        const timestamp = Date.now();
        const fileExtension = file.name.split('.').pop();
        const filename = `${timestamp}_${file.name}`;
        
        // Upload to Supabase storage
        const { data, error } = await supabaseClient.storage
            .from('canvas-media')
            .upload(filename, file);
        
        if (error) {
            console.error('Upload error:', error);
            AppGlobals.showStatus(`Failed to upload ${isVideo ? 'video' : 'image'}: ` + error.message);
            return;
        }
        
        // Get public URL
        const { data: urlData } = supabaseClient.storage
            .from('canvas-media')
            .getPublicUrl(filename);
        
        if (urlData?.publicUrl) {
            // Upload successful - public URL obtained
            AppGlobals.showStatus(`${isVideo ? 'Video' : 'Image'} uploaded successfully`);
            
            if (isVideo) {
                createVideoItem(urlData.publicUrl);
            } else {
                createImageItem(urlData.publicUrl);
            }
        } else {
            AppGlobals.showStatus(`Failed to get ${isVideo ? 'video' : 'image'} URL`);
        }
        
    } catch (error) {
        console.error('Error uploading file:', error);
        AppGlobals.showStatus('Upload failed - check console for details');
    }
    
    e.target.value = ''; // Reset input
}

function createImageItem(src, x = null, y = null, width = 200, height = 150, fromDatabase = false) {
    // Use viewport center for new items, explicit coordinates for database items
    if (x === null || y === null) {
        const viewportCenter = ViewportModule.getViewportCenter();
        x = x ?? (viewportCenter.x - width / 2);
        y = y ?? (viewportCenter.y - height / 2);
    }
    const item = document.createElement('div');
    item.className = 'canvas-item image-item';
    item.style.left = x + 'px';
    item.style.top = y + 'px';
    item.style.width = width + 'px';
    item.style.height = height + 'px';
    
    // Set default border radius as CSS variable
    item.style.setProperty('--item-border-radius', '0px');
    
    // Set z-index to be on top for new items
    if (!fromDatabase) {
        item.dataset.id = ++itemCounter;
        // Get the next available z-index (number of items + 1)
        const items = Array.from(canvas.querySelectorAll('.canvas-item'));
        item.style.zIndex = items.length + 1;
    }
    item.dataset.type = 'image';
    
    const img = document.createElement('img');
    img.loading = 'lazy'; // Enable lazy loading
    img.decoding = 'async'; // Enable async decoding
    
    // Progressive loading: check if we should load thumbnail first
    const shouldUseProgressiveLoading = !fromDatabase && isLargeImage(src);
    
    if (shouldUseProgressiveLoading) {
        // Load thumbnail first, then full resolution
        setupProgressiveImageLoading(img, src, item);
    } else {
        // Standard loading
        img.src = src;
    }
    
    // Set a default aspect ratio initially
    item.dataset.aspectRatio = width / height;
    
    // Add loading state
    item.classList.add('loading');
    
    // Store original source for progressive loading
    item.dataset.originalSrc = src;
    
    img.onload = function() {
        // Calculate and store the correct aspect ratio
        const aspectRatio = img.naturalWidth / img.naturalHeight;
        item.dataset.aspectRatio = aspectRatio;
        
        // Store original dimensions
        item.dataset.originalWidth = img.naturalWidth;
        item.dataset.originalHeight = img.naturalHeight;
        
        // Resize item to maintain natural aspect ratio
        // Keep the same area but adjust dimensions to match aspect ratio
        const currentWidth = parseFloat(item.style.width);
        const currentHeight = parseFloat(item.style.height);
        
        // Calculate new dimensions maintaining the same approximate area
        const currentArea = currentWidth * currentHeight;
        const newHeight = Math.sqrt(currentArea / aspectRatio);
        const newWidth = newHeight * aspectRatio;
        
        item.style.width = newWidth + 'px';
        item.style.height = newHeight + 'px';
        
        // Remove loading state
        item.classList.remove('loading');
        
        // Save to database if not from database
        if (!fromDatabase) {
            DatabaseModule.debouncedSaveItem(item);
        }
    };
    
    img.onerror = function() {
        console.error('Failed to load image:', src);
        item.classList.remove('loading');
        item.classList.add('error');
        AppGlobals.showStatus('Failed to load image');
    };
    
    item.appendChild(img);
    canvas.appendChild(item);
    
    // Add fade-in animation with subtle staggered delay
    let delay = 0;
    
    if (window.isInitialLoad) {
        // Very subtle stagger for initial load - much faster
        delay = window.initialLoadIndex * 15; // Just 15ms between each item
    } else {
        // Minimal delay for all other items to keep it responsive
        delay = Math.random() * 20; // Random 0-20ms delay for natural feel
    }
    
    setTimeout(() => {
        item.classList.add('fade-in-animation');
        setTimeout(() => {
            item.classList.remove('fade-in-animation');
        }, 500);
    }, delay);
    
    if (!fromDatabase) {
        ItemsModule.selectItem(item);
        // Save immediately with initial dimensions
        DatabaseModule.saveItemToDatabase(item);
    }
    
    return item;
}

function createVideoItem(src, x = null, y = null, width = 400, height = 300, fromDatabase = false) {
    // Use viewport center for new items, explicit coordinates for database items
    if (x === null || y === null) {
        const viewportCenter = ViewportModule.getViewportCenter();
        x = x ?? (viewportCenter.x - width / 2);
        y = y ?? (viewportCenter.y - height / 2);
    }
    const item = document.createElement('div');
    item.className = 'canvas-item video-item';
    item.style.left = x + 'px';
    item.style.top = y + 'px';
    item.style.width = width + 'px';
    item.style.height = height + 'px';
    
    // Set default border radius as CSS variable
    item.style.setProperty('--item-border-radius', '0px');
    
    // Set z-index to be on top for new items
    if (!fromDatabase) {
        item.dataset.id = ++itemCounter;
        // Get the next available z-index (number of items + 1)
        const items = Array.from(canvas.querySelectorAll('.canvas-item'));
        item.style.zIndex = items.length + 1;
    }
    item.dataset.type = 'video';
    
    const video = document.createElement('video');
    video.src = src;
    video.controls = false; // Disable controls to prevent iOS native controls
    video.muted = true; // Muted by default for autoplay compatibility
    video.autoplay = true; // Autoplay when loaded
    video.loop = true; // Loop continuously
    video.playsInline = true; // Required for iOS autoplay
    video.disablePictureInPicture = true; // Disable PiP on iOS
    video.disableRemotePlayback = true; // Disable AirPlay on iOS
    video.preload = 'metadata'; // Load metadata first for better mobile performance
    video.defaultMuted = true; // Ensure muted by default
    video.defaultPlaybackRate = 1.0; // Normal playback speed
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';
    video.style.display = 'block';
    video.style.pointerEvents = 'none'; // Prevent interaction with video
    
    // Calculate and store aspect ratio when video metadata loads
    video.addEventListener('loadedmetadata', function() {
        const aspectRatio = video.videoWidth / video.videoHeight;
        item.dataset.aspectRatio = aspectRatio;
        item.dataset.originalWidth = video.videoWidth;
        item.dataset.originalHeight = video.videoHeight;
        
        // Resize item to maintain natural aspect ratio
        // Keep the same area but adjust dimensions to match aspect ratio
        const currentWidth = parseFloat(item.style.width);
        const currentHeight = parseFloat(item.style.height);
        
        // Calculate new dimensions maintaining the same approximate area
        const currentArea = currentWidth * currentHeight;
        const newHeight = Math.sqrt(currentArea / aspectRatio);
        const newWidth = newHeight * aspectRatio;
        
        item.style.width = newWidth + 'px';
        item.style.height = newHeight + 'px';
        
        // Try to play video after metadata loads
        attemptVideoPlay(video);
        
        if (!fromDatabase) {
            DatabaseModule.debouncedSaveItem(item);
        }
    });
    
    // Ensure video plays when it can
    video.addEventListener('canplay', function() {
        attemptVideoPlay(video);
    });
    
    // Handle play events
    video.addEventListener('play', function() {
        // Video playback started successfully
    });
    
    video.addEventListener('pause', function() {
        // Try to resume playback if paused (but not too aggressively)
        if (!video.ended && !isUserPaused) {
            setTimeout(() => {
                attemptVideoPlay(video);
            }, 500);
        }
    });
    
    // Track if user manually paused
    let isUserPaused = false;
    video.addEventListener('pause', function() {
        // Check if pause was triggered by user interaction
        setTimeout(() => {
            isUserPaused = video.paused;
        }, 100);
    });
    
    // Reset user pause flag when video starts playing
    video.addEventListener('play', function() {
        isUserPaused = false;
    });
    
    video.addEventListener('error', function() {
        console.error('Failed to load video:', src);
        item.classList.add('error');
        AppGlobals.showStatus('Failed to load video');
    });
    
    item.appendChild(video);
    canvas.appendChild(item);
    
    // Add fade-in animation with subtle staggered delay
    let delay = 0;
    
    if (window.isInitialLoad) {
        // Very subtle stagger for initial load - much faster
        delay = window.initialLoadIndex * 15; // Just 15ms between each item
    } else {
        // Minimal delay for all other items to keep it responsive
        delay = Math.random() * 20; // Random 0-20ms delay for natural feel
    }
    
    setTimeout(() => {
        item.classList.add('fade-in-animation');
        setTimeout(() => {
            item.classList.remove('fade-in-animation');
        }, 500);
    }, delay);
    
    // Ensure video autoplay works on mobile with multiple attempts
    setTimeout(() => {
        attemptVideoPlay(video);
    }, 100);
    
    setTimeout(() => {
        attemptVideoPlay(video);
    }, 1000);
    
    if (!fromDatabase) {
        ItemsModule.selectItem(item);
        // Save immediately with initial dimensions
        DatabaseModule.saveItemToDatabase(item);
    }
    
    return item;
}

// Helper function to attempt video playback with better mobile support
function attemptVideoPlay(video) {
    if (!video || video.ended) return;
    
    // Ensure video is muted for autoplay
    video.muted = true;
    video.defaultMuted = true;
    
    // Try to play the video
    if (video.paused) {
        const playPromise = video.play();
        
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                // Video autoplay prevented - will retry on user interaction
                
                // For mobile, try again after user interaction
                if (error.name === 'NotAllowedError') {
                    // Add a one-time click listener to start playback
                    const startPlayback = () => {
                        video.play().catch(e => {/* Video still prevented */});
                        document.removeEventListener('touchstart', startPlayback);
                        document.removeEventListener('click', startPlayback);
                    };
                    
                    document.addEventListener('touchstart', startPlayback, { once: true });
                    document.addEventListener('click', startPlayback, { once: true });
                }
            });
        }
    }
}

function addText() {
    const viewportCenter = ViewportModule.getViewportCenter();
    // Create text at viewport center, will be centered after creation
    createTextItem('Double-click to edit text...', viewportCenter.x, viewportCenter.y);
}

function createTextItem(content = 'Double-click to edit text...', x = null, y = null, width = null, height = null, fromDatabase = false) {
    // Use viewport center for new items, explicit coordinates for database items
    if (x === null || y === null) {
        const viewportCenter = ViewportModule.getViewportCenter();
        x = x ?? viewportCenter.x;
        y = y ?? viewportCenter.y;
    }
    const item = document.createElement('div');
    item.className = 'canvas-item text-item';
    item.style.left = x + 'px';
    item.style.top = y + 'px';
    item.contentEditable = false; // Start in non-editing mode
    item.textContent = content;
    
    // Set default text styling
    item.style.fontFamily = 'Antarctica';
    item.style.fontSize = '24px';
    item.style.fontWeight = '400';
    item.style.color = '#333333';
    item.style.lineHeight = '1.15';
    item.style.setProperty('font-variation-settings', '');
    item.style.padding = '8px';
    
    // Set dimensions if provided (from database) or use auto-sizing
    if (width && width > 0) {
        item.style.width = width + 'px';
    } else if (!fromDatabase) {
        // Auto-size to content for new items
        item.style.width = 'auto';
        item.style.minWidth = '50px';
    }
    
    if (height && height > 0) {
        item.style.height = height + 'px';
    } else if (!fromDatabase) {
        // Auto-size to content for new items
        item.style.height = 'auto';
        item.style.minHeight = '30px';
    }
    
    // Set default border radius as CSS variable
    item.style.setProperty('--item-border-radius', '0px');
    
    // Set z-index to be on top for new items
    if (!fromDatabase) {
        item.dataset.id = ++itemCounter;
        // Get the next available z-index (number of items + 1)
        const items = Array.from(canvas.querySelectorAll('.canvas-item'));
        item.style.zIndex = items.length + 1;
    }
    item.dataset.type = 'text';
    
    // Double-click to enter text editing mode
    item.addEventListener('dblclick', (e) => {
        // Double-click event triggered on text item
        e.stopPropagation();
        
        // Check if user is authenticated admin
        if (!isAuthenticated) {
            ToolbarModule.showStatus('Only admin users can edit text');
            return;
        }
        
        // Temporarily hide resize handles during editing
        const resizeHandles = item.querySelector('.resize-handles');
        if (resizeHandles) {
            resizeHandles.style.display = 'none';
        }
        
        item.contentEditable = true;
        item.focus();
        item.classList.add('editing');
        
        // Text item entered editing mode
        
        // Select all text for easy editing
        const range = document.createRange();
        range.selectNodeContents(item);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    });
    
    // Handle text editing
    item.addEventListener('focus', () => {
        // Text item focused - checking editing state
        // Only add editing class if the item is already selected and not just being clicked
        if (item.classList.contains('selected') && item.contentEditable === 'true') {
            item.classList.add('editing');
            // Added editing class to text item
        }
    });
    
    // Add input event to catch text changes
    item.addEventListener('input', () => {
        // Text content changed during editing
    });
    
    item.addEventListener('blur', () => {
        // Text editing finished (blur event)
        
        item.classList.remove('editing');
        item.contentEditable = false;
        
        // Show resize handles again after editing
        const resizeHandles = item.querySelector('.resize-handles');
        if (resizeHandles) {
            resizeHandles.style.display = '';
        }
        
        // Always save text changes, regardless of origin
        // Saving text changes to database
        DatabaseModule.saveItemToDatabase(item);
    });
    
    // Also save when the user finishes editing (Enter key)
    item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            // Enter key pressed - finishing text editing
            e.preventDefault();
            item.blur();
            // Ensure save happens even if blur event is prevented
            // Saving text changes via Enter key
            DatabaseModule.saveItemToDatabase(item);
        }
    });
    
    
    canvas.appendChild(item);
    
    // Add fade-in animation with subtle staggered delay
    let delay = 0;
    
    if (window.isInitialLoad) {
        // Very subtle stagger for initial load - much faster
        delay = window.initialLoadIndex * 15; // Just 15ms between each item
    } else {
        // Minimal delay for all other items to keep it responsive
        delay = Math.random() * 20; // Random 0-20ms delay for natural feel
    }
    
    setTimeout(() => {
        item.classList.add('fade-in-animation');
        setTimeout(() => {
            item.classList.remove('fade-in-animation');
        }, 500);
    }, delay);
    
    // Center the text item if it's not from database and using viewport center
    if (!fromDatabase && x !== null && y !== null) {
        // Force layout calculation to get actual dimensions
        const rect = item.getBoundingClientRect();
        const itemWidth = rect.width;
        const itemHeight = rect.height;
        
        // If we used viewport center, adjust position to center the item
        const viewportCenter = ViewportModule.getViewportCenter();
        if (Math.abs(x - viewportCenter.x) < 1 && Math.abs(y - viewportCenter.y) < 1) {
            item.style.left = (viewportCenter.x - itemWidth / 2) + 'px';
            item.style.top = (viewportCenter.y - itemHeight / 2) + 'px';
        }
    }
    
    if (!fromDatabase) {
        ItemsModule.selectItem(item);
        DatabaseModule.saveItemToDatabase(item);
    }
    
    return item;
}

function addCode() {
    document.getElementById('codeModal').classList.remove('hidden');
    document.getElementById('codeInput').focus();
}

function insertCode() {
    const code = document.getElementById('codeInput').value.trim();
    if (!code) return;
    
    const viewportCenter = ViewportModule.getViewportCenter();
    createCodeItem(code, viewportCenter.x, viewportCenter.y);
    AppGlobals.closeModal('codeModal');
    document.getElementById('codeInput').value = '';
}

function createCodeItem(htmlContent, x = null, y = null, width = 400, height = 300, fromDatabase = false) {
    // Use viewport center for new items, explicit coordinates for database items
    if (x === null || y === null) {
        const viewportCenter = ViewportModule.getViewportCenter();
        x = x ?? (viewportCenter.x - width / 2);
        y = y ?? (viewportCenter.y - height / 2);
    }
    const item = document.createElement('div');
    item.className = 'canvas-item code-item';
    item.style.left = x + 'px';
    item.style.top = y + 'px';
    item.style.width = width + 'px';
    item.style.height = height + 'px';
    
    // Set default border radius as CSS variable
    item.style.setProperty('--item-border-radius', '0px');
    
    // Set z-index to be on top for new items
    if (!fromDatabase) {
        item.dataset.id = ++itemCounter;
        // Get the next available z-index (number of items + 1)
        const items = Array.from(canvas.querySelectorAll('.canvas-item'));
        item.style.zIndex = items.length + 1;
    }
    item.dataset.type = 'code';
    
    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.pointerEvents = 'none';
    iframe.srcdoc = htmlContent;
    
    item.appendChild(iframe);
    canvas.appendChild(item);
    
    // Add fade-in animation with subtle staggered delay
    let delay = 0;
    
    if (window.isInitialLoad) {
        // Very subtle stagger for initial load - much faster
        delay = window.initialLoadIndex * 15; // Just 15ms between each item
    } else {
        // Minimal delay for all other items to keep it responsive
        delay = Math.random() * 20; // Random 0-20ms delay for natural feel
    }
    
    setTimeout(() => {
        item.classList.add('fade-in-animation');
        setTimeout(() => {
            item.classList.remove('fade-in-animation');
        }, 500);
    }, delay);
    
    // Add the interaction overlay after the item is in the DOM
    addInteractionOverlay(item);
    
    if (!fromDatabase) {
        ItemsModule.selectItem(item);
        DatabaseModule.saveItemToDatabase(item);
    }
    
    return item;
}

// Function to update existing code items with new interaction system
function updateExistingCodeItems() {
    const existingCodeItems = document.querySelectorAll('.code-item');
    
    existingCodeItems.forEach(item => {
        // Remove any existing interaction overlay
        const existingOverlay = item.querySelector('.code-interaction-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
        
        // Remove old double-click event listeners by cloning the element
        const newItem = item.cloneNode(true);
        item.parentNode.replaceChild(newItem, item);
        
        // Add new interaction overlay to existing items
        addInteractionOverlay(newItem);
    });
    
    console.log(`Updated ${existingCodeItems.length} existing code items with new interaction system`);
}

// Helper function to add interaction overlay (extracted from createCodeItem)
function addInteractionOverlay(item) {
    const iframe = item.querySelector('iframe');
    if (!iframe) return;
    
    // Create centered interaction overlay with Figma design
    const interactionOverlay = document.createElement('div');
    interactionOverlay.className = 'code-interaction-overlay';
    interactionOverlay.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        backdrop-filter: blur(50px);
        background: rgba(0, 0, 0, 0.5);
        border-radius: 1000px;
        cursor: pointer;
        z-index: 10;
        transition: all 0.2s ease;
        opacity: 0.9;
        padding: 3px;
        border: 1px solid rgba(0, 0, 0, 0.08);
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    // Inner button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        background: rgba(0, 0, 0, 0.2);
        border-radius: 50px;
        padding: 11px 23px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(0, 0, 0, 0.08);
        white-space: nowrap;
    `;
    
    // Text content
    buttonContainer.innerHTML = `
        <span style="
            font-family: 'Antarctica', sans-serif;
            font-size: 16px;
            color: white;
            line-height: 1;
            font-weight: 400;
        ">Play With Me</span>
    `;
    
    interactionOverlay.appendChild(buttonContainer);
    
    // Toggle interaction on overlay click/touch
    function toggleInteractivity(e) {
        e.stopPropagation();
        e.preventDefault(); // Fix desktop click issue
        
        if (item.classList.contains('interactive')) {
            // Disable interaction - show button again
            item.classList.remove('interactive');
            iframe.style.pointerEvents = 'none';
            interactionOverlay.style.display = 'flex';
            interactionOverlay.style.opacity = '0.9';
            interactionOverlay.style.visibility = 'visible';
            interactionOverlay.style.pointerEvents = 'auto';
        } else {
            // Enable interaction - hide button completely
            pauseAllOtherCodeItems(item); // Pause other active code items
            item.classList.add('interactive');
            iframe.style.pointerEvents = 'auto';
            interactionOverlay.style.display = 'none';
            interactionOverlay.style.visibility = 'hidden';
            interactionOverlay.style.pointerEvents = 'none';
        }
    }
    
    // Universal click/touch events for all devices
    interactionOverlay.addEventListener('click', toggleInteractivity);
    interactionOverlay.addEventListener('touchend', (e) => {
        e.preventDefault(); // Prevent double-tap zoom
        toggleInteractivity(e);
    });
    
    // Show overlay behavior - always visible but with hover effects on desktop
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                     (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
    
    if (isMobile) {
        // Always fully visible on mobile
        interactionOverlay.style.opacity = '0.9';
    } else {
        // Show on hover for desktop with subtle default visibility
        interactionOverlay.style.opacity = '0.6';
        item.addEventListener('mouseenter', () => {
            interactionOverlay.style.opacity = '1';
            interactionOverlay.style.transform = 'translate(-50%, -50%) scale(1.05)';
        });
        item.addEventListener('mouseleave', () => {
            interactionOverlay.style.opacity = '0.6';
            interactionOverlay.style.transform = 'translate(-50%, -50%) scale(1)';
        });
    }
    
    item.appendChild(interactionOverlay);
    
    // Check if play button should be hidden based on item setting
    if (item.dataset.showPlayButton === 'false') {
        interactionOverlay.style.display = 'none';
        interactionOverlay.style.visibility = 'hidden';
        interactionOverlay.style.pointerEvents = 'none';
    }
}

// Function to pause all other active code items
function pauseAllOtherCodeItems(currentItem) {
    const allCodeItems = document.querySelectorAll('.code-item.interactive');
    allCodeItems.forEach(codeItem => {
        if (codeItem !== currentItem) {
            // Pause this item
            codeItem.classList.remove('interactive');
            const iframe = codeItem.querySelector('iframe');
            if (iframe) {
                iframe.style.pointerEvents = 'none';
            }
            
            // Show the play button again (only if showPlayButton is not disabled)
            const overlay = codeItem.querySelector('.code-interaction-overlay');
            if (overlay && codeItem.dataset.showPlayButton !== 'false') {
                overlay.style.display = 'flex';
                overlay.style.opacity = '0.9';
                overlay.style.visibility = 'visible';
                overlay.style.pointerEvents = 'auto';
            }
        }
    });
}

// Auto-pause code items when scrolling/panning away or clicking elsewhere
function setupCodeItemAutoPause() {
    let pauseTimeout;
    
    const pauseActiveCodeItems = () => {
        const activeCodeItems = document.querySelectorAll('.code-item.interactive');
        console.log('🔄 PAUSING ITEMS:', activeCodeItems.length, 'active code items found');
        
        activeCodeItems.forEach((item, index) => {
            console.log(`🔄 Pausing item ${index + 1}:`, {
                id: item.dataset.id,
                hasOverlay: !!item.querySelector('.code-interaction-overlay')
            });
            
            // Pause this item
            item.classList.remove('interactive');
            const iframe = item.querySelector('iframe');
            if (iframe) {
                iframe.style.pointerEvents = 'none';
            }
            
            // Show the play button again (only if showPlayButton is not disabled)
            const overlay = item.querySelector('.code-interaction-overlay');
            if (overlay && item.dataset.showPlayButton !== 'false') {
                console.log('✅ Restoring button for item:', item.dataset.id);
                overlay.style.display = 'flex';
                overlay.style.opacity = '0.9';
                overlay.style.visibility = 'visible';
                overlay.style.pointerEvents = 'auto';
                
                // Force a style recalculation
                overlay.offsetHeight; // Trigger reflow
            } else {
                if (overlay && item.dataset.showPlayButton === 'false') {
                    console.log('🚫 Play button disabled for item:', item.dataset.id);
                } else {
                    console.log('❌ No overlay found for item:', item.dataset.id);
                }
            }
        });
    };
    
    const checkAndPauseDistantItems = () => {
        const viewportCenter = ViewportModule?.getViewportCenter() || { x: 0, y: 0 };
        const viewportBounds = getViewportBoundsForCodeItems(viewportCenter);
        const activeCodeItems = document.querySelectorAll('.code-item.interactive');
        
        activeCodeItems.forEach(item => {
            const rect = item.getBoundingClientRect();
            const itemCenterX = parseFloat(item.style.left) + parseFloat(item.style.width) / 2;
            const itemCenterY = parseFloat(item.style.top) + parseFloat(item.style.height) / 2;
            
            // Check if item is far from viewport
            const isOutOfView = (
                itemCenterX < viewportBounds.left - 500 ||
                itemCenterX > viewportBounds.right + 500 ||
                itemCenterY < viewportBounds.top - 500 ||
                itemCenterY > viewportBounds.bottom + 500
            );
            
            if (isOutOfView) {
                pauseActiveCodeItems();
            }
        });
    };
    
    const scheduleAutoPause = () => {
        clearTimeout(pauseTimeout);
        pauseTimeout = setTimeout(checkAndPauseDistantItems, 1000); // Check after 1 second of no movement
    };
    
    // Listen for viewport changes (scrolling/panning)
    if (window.ViewportModule) {
        const originalUpdateTransform = window.ViewportModule.updateCanvasTransform;
        window.ViewportModule.updateCanvasTransform = function() {
            const result = originalUpdateTransform.call(this);
            scheduleAutoPause();
            return result;
        };
    }
    
    // Listen for clicks outside of code items (clicking away) - DEBUG VERSION
    document.addEventListener('click', (e) => {
        console.log('🔍 CLICK DEBUG:', {
            target: e.target,
            targetClass: e.target.className,
            targetId: e.target.id,
            clickedCodeItem: e.target.closest('.code-item'),
            activeCodeItems: document.querySelectorAll('.code-item.interactive').length,
            eventType: 'click'
        });
        
        // Check if the click is outside any interactive code item
        const clickedCodeItem = e.target.closest('.code-item');
        const activeCodeItems = document.querySelectorAll('.code-item.interactive');
        
        if (activeCodeItems.length > 0 && !clickedCodeItem) {
            console.log('✅ PAUSING: Clicked outside all code items');
            pauseActiveCodeItems();
        } else if (clickedCodeItem && !clickedCodeItem.classList.contains('interactive')) {
            console.log('✅ PAUSING: Clicked different code item');
            pauseActiveCodeItems();
        } else {
            console.log('❌ NOT PAUSING: Click inside active code item or no active items');
        }
    }, true); // Use capture phase to catch events before canvas handlers
    
    // Listen for touches outside of code items (mobile)
    document.addEventListener('touchstart', (e) => {
        const clickedCodeItem = e.target.closest('.code-item');
        const activeCodeItems = document.querySelectorAll('.code-item.interactive');
        
        if (activeCodeItems.length > 0 && !clickedCodeItem) {
            // Touched outside all code items - pause all active ones
            pauseActiveCodeItems();
        } else if (clickedCodeItem && !clickedCodeItem.classList.contains('interactive')) {
            // Touched on a different (inactive) code item - pause all active ones
            pauseActiveCodeItems();
        }
    });
}

// Helper function to get viewport bounds for code items
function getViewportBoundsForCodeItems(center) {
    const containerRect = ViewportModule?.getContainerRect() || { width: 1000, height: 800 };
    const scale = canvasTransform?.scale || 1;
    
    const viewportWidth = containerRect.width / scale;
    const viewportHeight = containerRect.height / scale;
    
    return {
        left: center.x - viewportWidth / 2,
        right: center.x + viewportWidth / 2,
        top: center.y - viewportHeight / 2,
        bottom: center.y + viewportHeight / 2
    };
}

// Progressive image loading helper functions
function isLargeImage(src) {
    // Consider Supabase storage URLs as potentially large
    return src.includes('supabase') || src.includes('canvas-media');
}

function setupProgressiveImageLoading(img, fullSrc, item) {
    // For now, load full resolution immediately but with better optimization
    // In future, could implement thumbnail generation on upload
    
    // Add progressive loading class for styling
    item.classList.add('progressive-loading');
    
    // Create a low-quality placeholder while loading
    const placeholder = document.createElement('div');
    placeholder.className = 'image-placeholder';
    placeholder.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(45deg, #f0f0f0 25%, transparent 25%),
                    linear-gradient(-45deg, #f0f0f0 25%, transparent 25%),
                    linear-gradient(45deg, transparent 75%, #f0f0f0 75%),
                    linear-gradient(-45deg, transparent 75%, #f0f0f0 75%);
        background-size: 20px 20px;
        background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
        opacity: 0.3;
        border-radius: inherit;
        z-index: 1;
    `;
    
    item.appendChild(placeholder);
    
    // Load full resolution with intersection observer for viewport optimization
    if (window.IntersectionObserver) {
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    loadFullResolutionImage(img, fullSrc, item, placeholder);
                    imageObserver.unobserve(entry.target);
                }
            });
        }, {
            rootMargin: '200px' // Start loading 200px before entering viewport
        });
        
        imageObserver.observe(item);
    } else {
        // Fallback for browsers without IntersectionObserver
        setTimeout(() => {
            loadFullResolutionImage(img, fullSrc, item, placeholder);
        }, 100);
    }
}

function loadFullResolutionImage(img, src, item, placeholder) {
    // Add fade transition for smooth loading
    img.style.transition = 'opacity 0.3s ease-in-out';
    img.style.opacity = '0';
    
    img.onload = function() {
        // Remove placeholder and fade in image
        if (placeholder && placeholder.parentNode) {
            placeholder.remove();
        }
        
        img.style.opacity = '1';
        item.classList.remove('progressive-loading');
        
        // Trigger the existing onload handler logic
        const existingOnload = img.onload;
        img.onload = existingOnload;
        if (existingOnload) existingOnload.call(this);
    };
    
    img.onerror = function() {
        // Remove placeholder on error
        if (placeholder && placeholder.parentNode) {
            placeholder.remove();
        }
        
        item.classList.remove('progressive-loading');
        
        // Trigger existing error handler
        const existingOnerror = img.onerror;
        img.onerror = existingOnerror;
        if (existingOnerror) existingOnerror.call(this);
    };
    
    // Start loading full resolution
    img.src = src;
}

// Image dimension caching to prevent layout shifts
const imageDimensionCache = new Map();

function cacheImageDimensions(src, width, height) {
    imageDimensionCache.set(src, { width, height, timestamp: Date.now() });
    
    // Clean old entries (older than 1 hour)
    const oneHour = 60 * 60 * 1000;
    const now = Date.now();
    for (const [key, value] of imageDimensionCache.entries()) {
        if (now - value.timestamp > oneHour) {
            imageDimensionCache.delete(key);
        }
    }
}

function getCachedImageDimensions(src) {
    const cached = imageDimensionCache.get(src);
    if (cached && Date.now() - cached.timestamp < 60 * 60 * 1000) {
        return { width: cached.width, height: cached.height };
    }
    return null;
}

// Debug helper function
function debugCodeItemState() {
    const allCodeItems = document.querySelectorAll('.code-item');
    const activeCodeItems = document.querySelectorAll('.code-item.interactive');
    
    console.log('📊 CODE ITEM DEBUG REPORT:');
    console.log(`Total code items: ${allCodeItems.length}`);
    console.log(`Active code items: ${activeCodeItems.length}`);
    
    allCodeItems.forEach((item, index) => {
        const overlay = item.querySelector('.code-interaction-overlay');
        const iframe = item.querySelector('iframe');
        
        console.log(`📋 Item ${index + 1}:`, {
            id: item.dataset.id,
            isActive: item.classList.contains('interactive'),
            hasOverlay: !!overlay,
            overlayVisible: overlay ? overlay.style.display : 'no overlay',
            overlayOpacity: overlay ? overlay.style.opacity : 'no overlay',
            iframePointerEvents: iframe ? iframe.style.pointerEvents : 'no iframe',
            elementVisible: item.style.visibility,
            boundingRect: item.getBoundingClientRect()
        });
    });
    
    return {
        total: allCodeItems.length,
        active: activeCodeItems.length,
        items: allCodeItems
    };
}

// Export module
window.CreatorsModule = {
    addImage,
    handleFileSelect,
    createImageItem,
    createVideoItem,
    addText,
    createTextItem,
    addCode,
    insertCode,
    createCodeItem,
    updateExistingCodeItems,
    addInteractionOverlay,
    pauseAllOtherCodeItems,
    setupCodeItemAutoPause,
    debugCodeItemState
};