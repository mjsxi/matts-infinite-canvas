// Database operations module
// Handles all Supabase interactions, real-time subscriptions, and data persistence

// Debounced save function to prevent excessive database calls
let saveTimeout = null;
const SAVE_DELAY = 300; // 300ms delay
const DEBUG_MODE = false; // Toggle for production

// Batch save optimization
let pendingSaves = new Map();
let batchSaveTimeout = null;
const BATCH_SAVE_DELAY = 500; // 500ms for batch operations

function debouncedSaveItem(item) {
    if (DEBUG_MODE) {
        console.log('=== DEBOUNCED SAVE TRIGGERED ===');
        console.log('Debounced save for item:', {
            type: item.dataset.type,
            id: item.dataset.id,
            textContent: item.dataset.type === 'text' ? item.textContent : 'N/A'
        });
    }
    
    // Add to batch save queue
    pendingSaves.set(item.dataset.id, item);
    
    if (batchSaveTimeout) {
        clearTimeout(batchSaveTimeout);
    }
    
    batchSaveTimeout = setTimeout(() => {
        processBatchSave();
        batchSaveTimeout = null;
    }, BATCH_SAVE_DELAY);
    
    // Fallback to individual save for immediate saves
    if (saveTimeout) {
        if (DEBUG_MODE) console.log('Clearing existing save timeout');
        clearTimeout(saveTimeout);
    }
    
    saveTimeout = setTimeout(() => {
        // Only save if not already in batch queue or batch didn't process yet
        if (!pendingSaves.has(item.dataset.id)) {
            if (DEBUG_MODE) console.log('Debounced save timeout executing for item:', item.dataset.id);
            saveItemToDatabase(item);
        }
        saveTimeout = null;
    }, SAVE_DELAY);
}

async function saveItemToDatabase(item) {
    const isTextItem = item.dataset.type === 'text';
    const isDrawingItem = item.dataset.type === 'drawing';
    
    if (DEBUG_MODE) {
        // Debug: Log what type of item we're trying to save
        console.log('=== SAVE ITEM TO DATABASE ===');
        console.log('Attempting to save item:', {
            type: item.dataset.type,
            id: item.dataset.id,
            isTextItem,
            isDrawingItem,
            textContent: isTextItem ? item.textContent : null,
            innerHTML: isTextItem ? item.innerHTML : null
        });
    }
    
    // For text items, save width/height if they have been explicitly set
    const hasExplicitWidth = isTextItem && item.style.width && item.style.width !== '';
    const hasExplicitHeight = isTextItem && item.style.height && item.style.height !== '';
    
    // Get actual dimensions for text items
    const actualWidth = isTextItem ? (parseFloat(item.style.width) || item.offsetWidth) : (parseFloat(item.style.width) || 100);
    const actualHeight = isTextItem ? (parseFloat(item.style.height) || item.offsetHeight) : (parseFloat(item.style.height) || 100);
    
    const itemData = {
        id: parseInt(item.dataset.id),
        x: parseFloat(item.style.left) || 0,
        y: parseFloat(item.style.top) || 0,
        item_type: item.dataset.type,
        content: getItemContent(item),
        user_id: 'admin', // Set user ID - you can customize this
        width: actualWidth,
        height: actualHeight,
        original_width: isTextItem ? actualWidth : (parseFloat(item.style.width) || 100),
        original_height: isTextItem ? actualHeight : (parseFloat(item.style.height) || 100),
        aspect_ratio: parseFloat(item.dataset.aspectRatio) || 1,
        rotation: parseFloat(item.dataset.rotation) || 0,
        z_index: parseInt(item.style.zIndex) || 1,
        border_radius: parseFloat(item.style.getPropertyValue('--item-border-radius')) || 0,
        font_family: item.style.fontFamily || 'Antarctica',
        font_size: parseInt(item.style.fontSize) || 24,
        font_weight: item.style.fontWeight || 'normal',
        font_variation: item.style.getPropertyValue('font-variation-settings') || '',
        text_color: item.style.color || '#333333',
        line_height: parseFloat(item.style.lineHeight) || 1.15,
        html_content: item.dataset.type === 'code' ? getItemContent(item) : (isDrawingItem ? item.dataset.viewBox : null),
        stroke_thickness: isDrawingItem ? parseFloat(item.querySelector('path')?.getAttribute('stroke-width')) || 4 : null,
        stroke_color: isDrawingItem ? item.querySelector('path')?.getAttribute('stroke') || '#333333' : null
    };

    // Remove null values to avoid unnecessary database columns
    Object.keys(itemData).forEach(key => {
        if (itemData[key] === null || itemData[key] === undefined) {
            delete itemData[key];
        }
    });

    if (DEBUG_MODE) {
        // Debug: Log the content being extracted
        console.log('Item content extracted:', {
            type: item.dataset.type,
            content: itemData.content,
            contentLength: itemData.content ? itemData.content.length : 0
        });

        // Debug: Log the final data being sent to database
        console.log('Saving item data to database:', {
            id: itemData.id,
            type: itemData.item_type,
            x: itemData.x,
            y: itemData.y,
            content: itemData.content ? itemData.content.substring(0, 100) + '...' : null,
            hasContent: !!itemData.content,
            fullContent: itemData.content
        });

        // Debug logging for drawing items
        if (isDrawingItem) {
            console.log('Saving drawing item:', {
                id: itemData.id,
                content: itemData.content,
                stroke_color: itemData.stroke_color,
                stroke_thickness: itemData.stroke_thickness,
                html_content: itemData.html_content
            });
        }
    }

    try {
        if (DEBUG_MODE) {
            console.log('=== SENDING TO SUPABASE ===');
            console.log('Final itemData being sent:', JSON.stringify(itemData, null, 2));
        }
        
        const { data, error } = await supabaseClient
            .from('canvas_items')
            .upsert(itemData, { 
                onConflict: 'id',
                ignoreDuplicates: false 
            });

        if (error) {
            console.error('=== DATABASE SAVE ERROR ===');
            console.error('Database save error:', error);
            if (DEBUG_MODE) console.error('Failed item data:', itemData);
            AppGlobals.showStatus('Failed to save item - check console for details');
            throw error;
        }

        // Mark the save time to prevent real-time update loops
        item.dataset.lastSaveTime = Date.now().toString();
        
        if (DEBUG_MODE) {
            console.log('=== SAVE SUCCESSFUL ===');
            console.log('Item saved successfully:', itemData.id, 'Type:', itemData.item_type, 'Content:', itemData.content);
            console.log('Response data:', data);
        }
    } catch (error) {
        console.error('=== SAVE EXCEPTION ===');
        console.error('Error saving item to database:', error);
        if (DEBUG_MODE) console.error('Failed item data:', itemData);
        AppGlobals.showStatus('Save failed - check console for details');
    }
}

async function deleteItemFromDatabase(item) {
    try {
        const { error } = await supabaseClient
            .from('canvas_items')
            .delete()
            .eq('id', item.dataset.id);
        
        if (error) throw error;
        if (DEBUG_MODE) console.log('Item deleted:', item.dataset.id);
    } catch (error) {
        console.error('Error deleting item:', error);
        AppGlobals.showStatus('Failed to delete item - check console for details');
    }
}

async function saveCenterPoint() {
    try {
        const { error } = await supabaseClient
            .from('canvas_center')
            .upsert({
                id: 1,
                x: centerPoint.x,
                y: centerPoint.y
            });
        
        if (error) throw error;
        if (DEBUG_MODE) console.log('Center point saved:', centerPoint);
    } catch (error) {
        console.error('Error saving center point:', error);
        AppGlobals.showStatus('Failed to save center point - check console for details');
    }
}

async function loadCanvasData() {
    if (DEBUG_MODE) {
        console.log('Loading canvas data from Supabase...');
        console.log('Canvas element:', canvas);
        console.log('Container element:', container);
    }
    AppGlobals.showStatus('Loading canvas data...');
    
    try {
        // Test basic connection first
        const { data: connectionTest, error: connectionError } = await supabaseClient
            .from('canvas_items')
            .select('count', { count: 'exact', head: true });
        
        if (connectionError) {
            console.error('Connection test failed:', connectionError);
            AppGlobals.showStatus('Failed to connect to database - check your Supabase configuration');
            return;
        }
        
        if (DEBUG_MODE) console.log('Database connection successful');
        
        // Load items
        const { data: items, error: itemsError } = await supabaseClient
            .from('canvas_items')
            .select('*');
        
        if (itemsError) {
            console.error('Error loading items:', itemsError);
            AppGlobals.showStatus('Failed to load items: ' + itemsError.message);
            throw itemsError;
        }
        
        if (DEBUG_MODE) console.log('Items loaded:', items?.length || 0);
        
        // Store selection state before clearing items
        const wasItemSelected = selectedItem !== null;
        const selectedItemId = selectedItem ? selectedItem.dataset.id : null;
        const selectedItemType = selectedItem ? selectedItem.dataset.type : null;
        
        if (DEBUG_MODE) {
            console.log('Selection state before clearing:', {
                wasItemSelected,
                selectedItemId,
                selectedItemType,
                selectedItem: selectedItem
            });
        }
        
        // Clear existing items
        const existingItems = canvas.querySelectorAll('.canvas-item');
        existingItems.forEach(item => item.remove());
        
        // Sort items by z_index to ensure proper layering
        const sortedItems = items?.sort((a, b) => (a.z_index || 0) - (b.z_index || 0)) || [];
        
        // Create items from database data
        if (DEBUG_MODE) console.log('Creating items from database data:', sortedItems.length, 'items');
        sortedItems.forEach((itemData, index) => {
            try {
                if (DEBUG_MODE) console.log(`Creating item ${index + 1}:`, itemData);
                const item = createItemFromData(itemData);
                if (DEBUG_MODE) console.log(`Item ${index + 1} created:`, item);
            } catch (error) {
                console.error('Error creating item from data:', error, itemData);
            }
        });
        
        // Restore selection if an item was previously selected
        if (wasItemSelected && selectedItemId) {
            const newSelectedItem = canvas.querySelector(`[data-id="${selectedItemId}"]`);
            if (DEBUG_MODE) {
                console.log('Attempting to restore selection:', {
                    selectedItemId,
                    newSelectedItem,
                    newSelectedItemType: newSelectedItem ? newSelectedItem.dataset.type : null
                });
            }
            
            if (newSelectedItem) {
                // Small delay to ensure the item is fully created
                setTimeout(() => {
                    if (DEBUG_MODE) console.log('Restoring selection for item:', newSelectedItem);
                    ItemsModule.selectItem(newSelectedItem);
                    
                    // For text items, ensure they maintain selection
                    if (newSelectedItem.dataset.type === 'text') {
                        if (DEBUG_MODE) console.log('Ensuring text item maintains selection');
                        // Force the selection to stay
                        setTimeout(() => {
                            if (!newSelectedItem.classList.contains('selected')) {
                                if (DEBUG_MODE) console.log('Text item selection lost, restoring...');
                                ItemsModule.selectItem(newSelectedItem);
                            }
                        }, 50);
                    }
                }, 10);
            } else {
                if (DEBUG_MODE) console.log('Could not find item to restore selection:', selectedItemId);
            }
        }
        
        // Load center point
        const { data: center, error: centerError } = await supabaseClient
            .from('canvas_center')
            .select('*')
            .eq('id', 1)
            .single();
        
        if (centerError && centerError.code !== 'PGRST116') { // PGRST116 = not found
            console.error('Error loading center point:', centerError);
        } else if (center) {
            if (DEBUG_MODE) console.log('Center point loaded:', center);
            centerPoint = { x: center.x, y: center.y };
            // Center the canvas on the center point
            const containerRect = container.getBoundingClientRect();
            canvasTransform.x = containerRect.width / 2 - center.x * canvasTransform.scale;
            canvasTransform.y = containerRect.height / 2 - center.y * canvasTransform.scale;
            ViewportModule.updateCanvasTransform();
            
            // Show center indicator for authenticated admin users
            if (isAuthenticated && window.AdminModule) {
                window.AdminModule.showCenterIndicator(center.x, center.y);
            }
        }
        
        AppGlobals.showStatus('Canvas data loaded successfully');
        
    } catch (error) {
        console.error('Error loading canvas data:', error);
        AppGlobals.showStatus('Failed to load canvas data - check console for details');
    }
}

function setupRealtimeSubscription() {
    if (realtimeChannel) {
        supabaseClient.removeChannel(realtimeChannel);
    }
    
    realtimeChannel = supabaseClient
        .channel('canvas_changes')
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'canvas_items' },
            handleRealtimeInsert
        )
        .on('postgres_changes', 
            { event: 'UPDATE', schema: 'public', table: 'canvas_items' },
            handleRealtimeUpdate
        )
        .on('postgres_changes', 
            { event: 'DELETE', schema: 'public', table: 'canvas_items' },
            handleRealtimeDelete
        )
        .on('postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'canvas_center' },
            handleCenterUpdate
        )
        .on('error', (error) => {
            console.error('Real-time subscription error:', error);
            // Attempt to reconnect after a delay
            setTimeout(() => {
                if (isAuthenticated) {
                    if (DEBUG_MODE) console.log('Attempting to reconnect real-time subscription...');
                    setupRealtimeSubscription();
                }
            }, 5000);
        })
        .subscribe((status) => {
            if (DEBUG_MODE) {
                console.log('Real-time subscription status:', status);
                if (status === 'SUBSCRIBED') {
                    console.log('Successfully subscribed to real-time updates');
                }
            }
        });
}

function handleRealtimeInsert(payload) {
    const existingItem = canvas.querySelector(`[data-id="${payload.new.id}"]`);
    if (!existingItem) {
        if (DEBUG_MODE) console.log('Real-time insert:', payload.new);
        // Mark as coming from real-time for entrance animation
        payload.new.fromRealtime = true;
        const newItem = createItemFromData(payload.new);
        
        // Add entrance animation
        if (newItem) {
            newItem.style.opacity = '0';
            newItem.style.transform = (newItem.style.transform || '') + ' scale(0.8)';
            newItem.classList.add('remote-update');
            
            setTimeout(() => {
                newItem.style.transition = 'opacity var(--transition-normal), transform var(--transition-normal)';
                newItem.style.opacity = '1';
                newItem.style.transform = (newItem.style.transform || '').replace('scale(0.8)', 'scale(1)');
            }, 10);
            
            // Remove animation class after transition
            setTimeout(() => {
                newItem.classList.remove('remote-update');
            }, 300);
        }
        
        AppGlobals.showStatus('New item added by another user');
    } else {
        if (DEBUG_MODE) console.log('Ignoring duplicate real-time insert for existing item:', payload.new.id);
    }
}

function handleRealtimeUpdate(payload) {
    const existingItem = canvas.querySelector(`[data-id="${payload.new.id}"]`);
    if (existingItem && !isDragging && !isResizing) {
        // Skip updates for items that are currently being edited locally
        if (existingItem === selectedItem && existingItem.classList.contains('editing') && document.activeElement === existingItem) {
            if (DEBUG_MODE) console.log('Skipping real-time update for actively editing text item');
            return;
        }
        
        // Store a flag to prevent real-time loops
        if (existingItem.dataset.lastSaveTime && 
            Date.now() - parseInt(existingItem.dataset.lastSaveTime) < 1000) {
            if (DEBUG_MODE) console.log('Skipping real-time update - recent save detected');
            return;
        }
        
        // For selected items, only update content, not position/size to avoid conflicts
        if (existingItem === selectedItem) {
            const itemType = payload.new.item_type;
            if (itemType === 'text') {
                // Store current selection state
                const wasEditing = existingItem.classList.contains('editing');
                const wasFocused = document.activeElement === existingItem;
                const wasSelected = existingItem.classList.contains('selected');
                
                // Store resize handles before updating content
                const resizeHandles = existingItem.querySelector('.resize-handles');
                
                // Update content and properties
                // Clear all text nodes but preserve child elements (like resize handles)
                const textNodes = [];
                for (let i = 0; i < existingItem.childNodes.length; i++) {
                    const node = existingItem.childNodes[i];
                    if (node.nodeType === Node.TEXT_NODE) {
                        textNodes.push(node);
                    }
                }
                textNodes.forEach(node => node.remove());
                
                // Add the new text content
                existingItem.appendChild(document.createTextNode(payload.new.content));
                
                // Restore resize handles if they were removed
                if (resizeHandles && !existingItem.querySelector('.resize-handles')) {
                    existingItem.appendChild(resizeHandles);
                }
                
                if (DEBUG_MODE) {
                    console.log('Real-time text update:', {
                        newContent: payload.new.content,
                        itemTextContent: existingItem.textContent,
                        itemInnerHTML: existingItem.innerHTML.substring(0, 100) + '...',
                        hasResizeHandles: !!existingItem.querySelector('.resize-handles')
                    });
                }
                
                if (payload.new.font_family) existingItem.style.fontFamily = payload.new.font_family;
                if (payload.new.font_size) existingItem.style.fontSize = payload.new.font_size + 'px';
                if (payload.new.font_weight) existingItem.style.fontWeight = payload.new.font_weight;
                if (payload.new.text_color) existingItem.style.color = payload.new.text_color;
                if (payload.new.line_height) existingItem.style.lineHeight = payload.new.line_height;
                
                // Restore editing state if it was editing
                if (wasEditing) {
                    existingItem.classList.add('editing');
                    existingItem.contentEditable = true;
                }
                
                // Restore focus if it was focused
                if (wasFocused) {
                    existingItem.focus();
                }
                
                // Ensure selection state is maintained
                if (wasSelected && !existingItem.classList.contains('selected')) {
                    if (DEBUG_MODE) console.log('Restoring selection after real-time update');
                    ItemsModule.selectItem(existingItem);
                }
                
                if (DEBUG_MODE) console.log('Updated selected text item content:', payload.new.content);
            }
        } else {
            // Update all properties for non-selected items
            updateItemFromData(existingItem, payload.new);
        }
        
        // Only show status if it's not the current user's own update
        // This prevents showing "updated by another user" for our own changes
        if (payload.new.user_id !== 'admin') {
            AppGlobals.showStatus('Item updated by another user');
        }
    }
}

function handleRealtimeDelete(payload) {
    const existingItem = canvas.querySelector(`[data-id="${payload.old.id}"]`);
    if (existingItem && existingItem !== selectedItem) {
        // Add exit animation with pulse effect
        existingItem.classList.add('remote-update');
        existingItem.style.transition = 'opacity var(--transition-normal), transform var(--transition-normal)';
        existingItem.style.opacity = '0';
        existingItem.style.transform = (existingItem.style.transform || '') + ' scale(0.8)';
        
        // Remove after animation
        setTimeout(() => {
            existingItem.remove();
        }, 300);
        
        AppGlobals.showStatus('Item deleted by another user');
    }
}

function handleCenterUpdate(payload) {
    centerPoint = { x: payload.new.x, y: payload.new.y };
    AdminModule.showCenterIndicator(centerPoint.x, centerPoint.y);
    AppGlobals.showStatus('Center point updated by another user');
}

function createItemFromData(data) {
    let item;
    const itemType = data.item_type;
    
    // Update itemCounter to ensure new items get unique IDs
    if (data.id >= itemCounter) {
        itemCounter = data.id;
    }
    
    switch (itemType) {
        case 'image':
            item = CreatorsModule.createImageItem(data.content, data.x, data.y, data.width, data.height, true);
            break;
        case 'video':
            item = CreatorsModule.createVideoItem(data.content, data.x, data.y, data.width, data.height, true);
            break;
        case 'text':
            item = CreatorsModule.createTextItem(data.content, data.x, data.y, data.width, data.height, true);
            break;
        case 'code':
            // Use html_content if available, fallback to content
            const codeContent = data.html_content || data.content;
            item = CreatorsModule.createCodeItem(codeContent, data.x, data.y, data.width, data.height, true);
            break;
        case 'drawing':
            item = DrawingModule.createDrawingItem(data.content, data.stroke_color || '#333333', data.stroke_thickness || 4, data.x, data.y, data.width, data.height, true, data.html_content);
            break;
    }
    
    if (item) {
        // Set database ID
        item.dataset.id = data.id;
        
        // Apply all properties from database
        if (data.z_index) item.style.zIndex = data.z_index;
        if (data.rotation) item.dataset.rotation = data.rotation;
        if (data.border_radius) item.style.setProperty('--item-border-radius', data.border_radius + 'px');
        if (data.aspect_ratio) item.dataset.aspectRatio = data.aspect_ratio;
        if (data.original_width) item.dataset.originalWidth = data.original_width;
        if (data.original_height) item.dataset.originalHeight = data.original_height;
        
        // Apply text-specific properties
        if (itemType === 'text') {
            if (data.font_family) item.style.fontFamily = data.font_family;
            if (data.font_size) item.style.fontSize = data.font_size + 'px';
            if (data.font_weight) item.style.fontWeight = data.font_weight;
            if (data.font_variation) item.style.setProperty('font-variation-settings', data.font_variation);
            if (data.text_color) item.style.color = data.text_color;
            if (data.line_height) item.style.lineHeight = data.line_height;
        }
        
        // Apply rotation if present
        if (data.rotation && data.rotation !== 0) {
            item.style.transform = `rotate(${data.rotation}deg)`;
        }
        
        // Add entrance animation for real-time items
        if (data.fromRealtime) {
            item.style.opacity = '0';
            item.style.transform = (item.style.transform || '') + ' scale(0.8)';
            item.classList.add('remote-update');
            
            setTimeout(() => {
                item.style.transition = 'opacity var(--transition-normal), transform var(--transition-normal)';
                item.style.opacity = '1';
                item.style.transform = item.style.transform.replace('scale(0.8)', 'scale(1)');
            }, 10);
            
            // Remove animation class after transition
            setTimeout(() => {
                item.classList.remove('remote-update');
            }, 300);
        }
    }
    
    return item;
}

function updateItemFromData(item, data) {
    const itemType = data.item_type;
    
    // Add animation class for smooth transitions
    item.classList.add('remote-update');
    
    // Update position and dimensions
    item.style.left = data.x + 'px';
    item.style.top = data.y + 'px';
    if (data.width) item.style.width = data.width + 'px';
    if (data.height) item.style.height = data.height + 'px';
    if (data.z_index) item.style.zIndex = data.z_index;
    if (data.rotation !== undefined) item.dataset.rotation = data.rotation;
    if (data.border_radius !== undefined) item.style.setProperty('--item-border-radius', data.border_radius + 'px');
    
    // Remove animation class after transition
    setTimeout(() => {
        item.classList.remove('remote-update');
    }, 300);
    
    // Update content based on item type
    switch (itemType) {
        case 'text':
            item.textContent = data.content;
            if (data.font_family) item.style.fontFamily = data.font_family;
            if (data.font_size) item.style.fontSize = data.font_size + 'px';
            if (data.font_weight) item.style.fontWeight = data.font_weight;
            if (data.text_color) item.style.color = data.text_color;
            if (data.line_height) item.style.lineHeight = data.line_height;
            break;
        case 'image':
            const img = item.querySelector('img');
            if (img && img.src !== data.content) {
                img.src = data.content;
            }
            break;
        case 'video':
            const video = item.querySelector('video');
            if (video && video.src !== data.content) {
                video.src = data.content;
            }
            // Ensure video autoplay works for loaded videos
            if (video) {
                setTimeout(() => {
                    if (video.paused && !video.ended) {
                        video.play().catch(e => {
                            if (DEBUG_MODE) console.log('Video autoplay prevented for loaded video');
                        });
                    }
                }, 100);
            }
            break;
        case 'code':
            const iframe = item.querySelector('iframe');
            if (iframe) {
                // Update iframe content
                iframe.srcdoc = data.content;
            }
            break;
        case 'drawing':
            const path = item.querySelector('path');
            if (path) {
                // Update path data
                path.setAttribute('d', data.content);
                if (data.stroke_color) {
                    path.setAttribute('stroke', data.stroke_color);
                }
                if (data.stroke_thickness) {
                    path.setAttribute('stroke-width', data.stroke_thickness);
                }
                if (data.html_content) {
                    const svg = item.querySelector('svg');
                    if (svg) {
                        svg.setAttribute('viewBox', data.html_content);
                        item.dataset.viewBox = data.html_content;
                    }
                }
            }
            
            // Update drawing toolbar if this item is currently selected
            if (selectedItem === item && isAuthenticated && item.classList.contains('drawing-item')) {
                ToolbarModule.showDrawToolbar();
                if (path) {
                    const strokeColor = path.getAttribute('stroke') || '#333333';
                    document.getElementById('strokeColor').value = strokeColor;
                    document.getElementById('strokeThickness').value = path.getAttribute('stroke-width') || '8';
                    
                    // Update stroke color preview
                    const strokeColorPreview = document.getElementById('strokeColorPreview');
                    if (strokeColorPreview) {
                        strokeColorPreview.style.backgroundColor = strokeColor;
                    }
                }
            }
            break;
    }
    
    // Apply rotation if present
    if (data.rotation && data.rotation !== 0) {
        item.style.transform = `rotate(${data.rotation}deg)`;
    } else if (data.rotation === 0) {
        item.style.transform = '';
    }
}

function getItemContent(item) {
    if (DEBUG_MODE) {
        console.log('=== GET ITEM CONTENT ===');
        console.log('Getting content for item:', {
            type: item.dataset.type,
            id: item.dataset.id,
            element: item,
            textContent: item.textContent,
            innerHTML: item.innerHTML
        });
    }
    
    let content = '';
    switch (item.dataset.type) {
        case 'image':
            const img = item.querySelector('img');
            content = img ? img.src : '';
            if (DEBUG_MODE) console.log('Image content:', { src: content, hasImg: !!img });
            break;
        case 'video':
            const video = item.querySelector('video');
            content = video ? video.src : '';
            if (DEBUG_MODE) console.log('Video content:', { src: content, hasVideo: !!video });
            break;
        case 'text':
            // Clone the item to remove resize handles before extracting content
            const tempItem = item.cloneNode(true);
            const resizeHandles = tempItem.querySelector('.resize-handles');
            if (resizeHandles) {
                resizeHandles.remove();
            }
            content = tempItem.textContent;
            if (DEBUG_MODE) {
                console.log('Text content extraction:', { 
                    content: content.substring(0, 50) + '...', 
                    length: content.length,
                    textContent: content,
                    innerText: tempItem.innerText,
                    innerHTML: tempItem.innerHTML.substring(0, 100) + '...',
                    originalTextContent: item.textContent,
                    originalInnerHTML: item.innerHTML.substring(0, 100) + '...'
                });
            }
            break;
        case 'code':
            const iframe = item.querySelector('iframe');
            content = iframe ? iframe.srcdoc : '';
            if (DEBUG_MODE) console.log('Code content:', { content: content.substring(0, 50) + '...', length: content.length, hasIframe: !!iframe });
            break;
        case 'drawing':
            const path = item.querySelector('path');
            content = path ? path.getAttribute('d') : '';
            if (DEBUG_MODE) console.log('Drawing content:', { content: content.substring(0, 50) + '...', length: content.length, hasPath: !!path });
            break;
        default:
            content = '';
            if (DEBUG_MODE) console.log('Unknown item type:', item.dataset.type);
    }
    
    if (DEBUG_MODE) {
        console.log('Final content for', item.dataset.type, ':', {
            content: content.substring(0, 100) + '...',
            length: content.length,
            isEmpty: !content
        });
    }
    
    return content;
}

async function processBatchSave() {
    if (pendingSaves.size === 0) return;
    
    if (DEBUG_MODE) console.log('Processing batch save for', pendingSaves.size, 'items');
    
    // Convert items to data and batch save
    const itemsToSave = Array.from(pendingSaves.values());
    pendingSaves.clear();
    
    try {
        // Process in parallel for better performance
        const savePromises = itemsToSave.map(item => saveItemToDatabase(item));
        await Promise.allSettled(savePromises);
        
        if (DEBUG_MODE) console.log('Batch save completed for', itemsToSave.length, 'items');
    } catch (error) {
        console.error('Batch save error:', error);
    }
}

// Export module
window.DatabaseModule = {
    debouncedSaveItem,
    saveItemToDatabase,
    deleteItemFromDatabase,
    saveCenterPoint,
    loadCanvasData,
    setupRealtimeSubscription,
    handleRealtimeInsert,
    handleRealtimeUpdate,
    handleRealtimeDelete,
    handleCenterUpdate,
    createItemFromData,
    updateItemFromData,
    getItemContent,
    processBatchSave,
    
    // Debug function to test saving different item types
    testSaveItem: function(item) {
        console.log('=== TESTING ITEM SAVE ===');
        console.log('Item element:', item);
        console.log('Item dataset:', item.dataset);
        console.log('Item style:', {
            left: item.style.left,
            top: item.style.top,
            width: item.style.width,
            height: item.style.height,
            zIndex: item.style.zIndex
        });
        
        // Test content extraction
        const content = getItemContent(item);
        console.log('Extracted content:', content);
        
        // Test full save
        return saveItemToDatabase(item);
    },
    
    // Debug function to test text item specifically
    testTextItemSave: function() {
        console.log('=== TESTING TEXT ITEM SAVE ===');
        const textItems = canvas.querySelectorAll('.text-item');
        console.log('Found text items:', textItems.length);
        
        textItems.forEach((item, index) => {
            console.log(`\n--- Text Item ${index + 1} ---`);
            console.log('Text content:', item.textContent);
            console.log('Inner text:', item.innerText);
            console.log('Inner HTML:', item.innerHTML);
            console.log('Content editable:', item.contentEditable);
            console.log('Is editing:', item.classList.contains('editing'));
            
            // Test save
            this.testSaveItem(item);
        });
    },
    
    // Debug function to test saving all items on canvas
    testSaveAllItems: function() {
        console.log('=== TESTING ALL ITEMS SAVE ===');
        const items = canvas.querySelectorAll('.canvas-item');
        console.log('Found', items.length, 'items on canvas');
        
        items.forEach((item, index) => {
            console.log(`\n--- Item ${index + 1} ---`);
            console.log('Type:', item.dataset.type);
            console.log('ID:', item.dataset.id);
            console.log('Position:', item.style.left, item.style.top);
            
            // Test save for this item
            this.testSaveItem(item);
        });
    },
    
    // Comprehensive test to identify sync issues
    comprehensiveTest: async function() {
        console.log('=== COMPREHENSIVE SYNC TEST ===');
        
        // Test 1: Check database connection
        console.log('\n1. Testing database connection...');
        try {
            const { data, error } = await supabaseClient
                .from('canvas_items')
                .select('count', { count: 'exact', head: true });
            
            if (error) {
                console.error('Database connection failed:', error);
                return;
            }
            console.log('Database connection successful');
        } catch (error) {
            console.error('Database connection error:', error);
            return;
        }
        
        // Test 2: Check current items in database
        console.log('\n2. Checking current items in database...');
        try {
            const { data: items, error } = await supabaseClient
                .from('canvas_items')
                .select('*');
            
            if (error) {
                console.error('Failed to load items:', error);
            } else {
                console.log('Items in database:', items?.length || 0);
                items?.forEach(item => {
                    console.log(`- ID: ${item.id}, Type: ${item.item_type}, Content: ${item.content ? item.content.substring(0, 50) + '...' : 'null'}`);
                });
            }
        } catch (error) {
            console.error('Error loading items:', error);
        }
        
        // Test 3: Test saving each item type
        console.log('\n3. Testing save for each item type...');
        const canvasItems = canvas.querySelectorAll('.canvas-item');
        console.log('Canvas items found:', canvasItems.length);
        
        for (let i = 0; i < canvasItems.length; i++) {
            const item = canvasItems[i];
            console.log(`\n--- Testing item ${i + 1} (${item.dataset.type}) ---`);
            
            // Test content extraction
            const content = getItemContent(item);
            console.log('Content extracted:', content ? content.substring(0, 100) + '...' : 'null');
            
            // Test save
            try {
                await saveItemToDatabase(item);
                console.log('Save successful');
            } catch (error) {
                console.error('Save failed:', error);
            }
        }
        
        console.log('\n=== COMPREHENSIVE TEST COMPLETE ===');
    },
    
    // Test database schema with simple inserts
    testDatabaseSchema: async function() {
        console.log('=== TESTING DATABASE SCHEMA ===');
        
        const testItems = [
            {
                id: 999999,
                item_type: 'image',
                content: 'https://example.com/test-image.jpg',
                x: 100,
                y: 100,
                width: 200,
                height: 150,
                user_id: 'admin'
            },
            {
                id: 999998,
                item_type: 'video',
                content: 'https://example.com/test-video.mp4',
                x: 300,
                y: 100,
                width: 300,
                height: 200,
                user_id: 'admin'
            },
            {
                id: 999997,
                item_type: 'code',
                content: '<div>Test HTML</div>',
                x: 100,
                y: 300,
                width: 200,
                height: 100,
                user_id: 'admin'
            },
            {
                id: 999996,
                item_type: 'drawing',
                content: 'M 10 10 L 100 100',
                x: 300,
                y: 300,
                width: 200,
                height: 100,
                stroke_color: '#ff0000',
                stroke_thickness: 4,
                user_id: 'admin'
            }
        ];
        
        for (const testItem of testItems) {
            console.log(`\nTesting ${testItem.item_type} insert...`);
            try {
                const { data, error } = await supabaseClient
                    .from('canvas_items')
                    .upsert(testItem, { 
                        onConflict: 'id',
                        ignoreDuplicates: false 
                    });
                
                if (error) {
                    console.error(`Failed to insert ${testItem.item_type}:`, error);
                } else {
                    console.log(`Successfully inserted ${testItem.item_type}`);
                }
            } catch (error) {
                console.error(`Error inserting ${testItem.item_type}:`, error);
            }
        }
        
        // Clean up test items
        console.log('\nCleaning up test items...');
        try {
            const { error } = await supabaseClient
                .from('canvas_items')
                .delete()
                .in('id', [999999, 999998, 999997, 999996]);
            
            if (error) {
                console.error('Failed to clean up test items:', error);
            } else {
                console.log('Test items cleaned up successfully');
            }
        } catch (error) {
            console.error('Error cleaning up test items:', error);
        }
        
        console.log('=== DATABASE SCHEMA TEST COMPLETE ===');
    }
};