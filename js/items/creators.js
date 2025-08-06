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
            console.log(`${isVideo ? 'Video' : 'Image'} uploaded successfully:`, urlData.publicUrl);
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
    img.src = src;
    
    // Set a default aspect ratio initially
    item.dataset.aspectRatio = width / height;
    
    // Add loading state
    item.classList.add('loading');
    
    img.onload = function() {
        // Calculate and store the correct aspect ratio
        const aspectRatio = img.naturalWidth / img.naturalHeight;
        item.dataset.aspectRatio = aspectRatio;
        
        // Store original dimensions
        item.dataset.originalWidth = img.naturalWidth;
        item.dataset.originalHeight = img.naturalHeight;
        
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
        console.log('Video started playing');
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
                console.log('Video autoplay prevented:', error.name);
                
                // For mobile, try again after user interaction
                if (error.name === 'NotAllowedError') {
                    // Add a one-time click listener to start playback
                    const startPlayback = () => {
                        video.play().catch(e => console.log('Still prevented'));
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
    
    // Create a text container for editing
    const textContainer = document.createElement('div');
    textContainer.className = 'text-content';
    textContainer.textContent = content;
    textContainer.contentEditable = false;
    item.appendChild(textContainer);
    
    // Set default text styling
    item.style.fontFamily = 'Antarctica';
    item.style.fontSize = '24px';
    item.style.fontWeight = '400';
    item.style.color = '#333333';
    item.style.lineHeight = '1.15';
    item.style.padding = '8px';
    
    // Set dimensions if provided (from database)
    if (width && width > 0) {
        item.style.width = width + 'px';
    }
    
    if (height && height > 0) {
        item.style.height = height + 'px';
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
        e.stopPropagation();
        textContainer.contentEditable = true;
        textContainer.focus();
        item.classList.add('editing');
        
        // Select all text for easy editing
        const range = document.createRange();
        range.selectNodeContents(textContainer);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    });
    
    // Handle text editing
    textContainer.addEventListener('focus', () => {
        // Only add editing class if the item is already selected and not just being clicked
        if (item.classList.contains('selected') && textContainer.contentEditable === 'true') {
            item.classList.add('editing');
        }
    });
    textContainer.addEventListener('blur', () => {
        item.classList.remove('editing');
        textContainer.contentEditable = false;
        // Save to database if not from database recreation and not during real-time updates
        // But allow saving if the user actually edited the content
        if (!fromDatabase && !item.dataset.isUpdating) {
            DatabaseModule.saveItemToDatabase(item);
        }
    });
    
    // Also save when the user finishes editing (Enter key)
    textContainer.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            textContainer.blur();
            // Ensure save happens even if blur event is prevented
            if (!fromDatabase && !item.dataset.isUpdating) {
                DatabaseModule.saveItemToDatabase(item);
            }
        }
    });
    
    canvas.appendChild(item);
    
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
    
    // Toggle interactivity on click
    item.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isAuthenticated) {
            item.classList.toggle('interactive');
            iframe.style.pointerEvents = item.classList.contains('interactive') ? 'auto' : 'none';
        }
    });
    
    item.appendChild(iframe);
    canvas.appendChild(item);
    
    if (!fromDatabase) {
        ItemsModule.selectItem(item);
        DatabaseModule.saveItemToDatabase(item);
    }
    
    return item;
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
    createCodeItem
};