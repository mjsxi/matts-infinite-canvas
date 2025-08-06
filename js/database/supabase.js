// Database operations module
// Handles all Supabase interactions, real-time subscriptions, and data persistence

// Debounced save function to prevent excessive database calls
let saveTimeout = null;
const SAVE_DELAY = 300; // 300ms delay

function debouncedSaveItem(item) {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }
    
    saveTimeout = setTimeout(() => {
        saveItemToDatabase(item);
        saveTimeout = null;
    }, SAVE_DELAY);
}

async function saveItemToDatabase(item) {
    const isTextItem = item.dataset.type === 'text';
    const isDrawingItem = item.dataset.type === 'drawing';
    
    // For text items, save width/height if they have been explicitly set
    const hasExplicitWidth = isTextItem && item.style.width && item.style.width !== '';
    const hasExplicitHeight = isTextItem && item.style.height && item.style.height !== '';
    
    const itemData = {
        id: parseInt(item.dataset.id),
        x: parseFloat(item.style.left) || 0,
        y: parseFloat(item.style.top) || 0,
        item_type: item.dataset.type,
        content: getItemContent(item),
        user_id: 'admin', // Set user ID - you can customize this
        width: hasExplicitWidth ? (parseFloat(item.style.width) || null) : (isTextItem ? null : (parseFloat(item.style.width) || 100)),
        height: hasExplicitHeight ? (parseFloat(item.style.height) || null) : (isTextItem ? null : (parseFloat(item.style.height) || 100)),
        original_width: isTextItem ? null : (parseFloat(item.style.width) || 100),
        original_height: isTextItem ? null : (parseFloat(item.style.height) || 100),
        aspect_ratio: parseFloat(item.dataset.aspectRatio) || 1,
        rotation: parseFloat(item.dataset.rotation) || 0,
        z_index: parseInt(item.style.zIndex) || 1,
        border_radius: parseFloat(item.style.getPropertyValue('--item-border-radius')) || 0,
        font_family: item.style.fontFamily || 'Antarctica',
        font_size: parseInt(item.style.fontSize) || 24,
        font_weight: item.style.fontWeight || 'normal',
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

    try {
        const { data, error } = await supabaseClient
            .from('canvas_items')
            .upsert(itemData, { 
                onConflict: 'id',
                ignoreDuplicates: false 
            });

        if (error) {
            console.error('Database save error:', error);
            AppGlobals.showStatus('Failed to save item - check console for details');
            throw error;
        }

        console.log('Item saved successfully:', itemData.id);
    } catch (error) {
        console.error('Error saving item to database:', error);
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
        console.log('Item deleted:', item.dataset.id);
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
        console.log('Center point saved:', centerPoint);
    } catch (error) {
        console.error('Error saving center point:', error);
        AppGlobals.showStatus('Failed to save center point - check console for details');
    }
}

async function loadCanvasData() {
    console.log('Loading canvas data from Supabase...');
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
        
        console.log('Database connection successful');
        
        // Load items
        const { data: items, error: itemsError } = await supabaseClient
            .from('canvas_items')
            .select('*');
        
        if (itemsError) {
            console.error('Error loading items:', itemsError);
            AppGlobals.showStatus('Failed to load items: ' + itemsError.message);
            throw itemsError;
        }
        
        console.log('Items loaded:', items?.length || 0);
        
        // Clear existing items
        const existingItems = canvas.querySelectorAll('.canvas-item');
        existingItems.forEach(item => item.remove());
        
        // Sort items by z_index to ensure proper layering
        const sortedItems = items?.sort((a, b) => (a.z_index || 0) - (b.z_index || 0)) || [];
        
        // Create items from database data
        sortedItems.forEach(itemData => {
            try {
                createItemFromData(itemData);
            } catch (error) {
                console.error('Error creating item from data:', error, itemData);
            }
        });
        
        // Load center point
        const { data: center, error: centerError } = await supabaseClient
            .from('canvas_center')
            .select('*')
            .eq('id', 1)
            .single();
        
        if (centerError && centerError.code !== 'PGRST116') { // PGRST116 = not found
            console.error('Error loading center point:', centerError);
        } else if (center) {
            console.log('Center point loaded:', center);
            centerPoint = { x: center.x, y: center.y };
            // Center the canvas on the center point
            const containerRect = container.getBoundingClientRect();
            canvasTransform.x = containerRect.width / 2 - center.x * canvasTransform.scale;
            canvasTransform.y = containerRect.height / 2 - center.y * canvasTransform.scale;
            ViewportModule.updateCanvasTransform();
            
            AdminModule.showCenterIndicator(center.x, center.y);
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
                    console.log('Attempting to reconnect real-time subscription...');
                    setupRealtimeSubscription();
                }
            }, 5000);
        })
        .subscribe((status) => {
            console.log('Real-time subscription status:', status);
            if (status === 'SUBSCRIBED') {
                console.log('Successfully subscribed to real-time updates');
            }
        });
}

function handleRealtimeInsert(payload) {
    const existingItem = canvas.querySelector(`[data-id="${payload.new.id}"]`);
    if (!existingItem) {
        console.log('Real-time insert:', payload.new);
        // Mark as coming from real-time for entrance animation
        payload.new.fromRealtime = true;
        createItemFromData(payload.new);
        AppGlobals.showStatus('New item added by another user');
    } else {
        console.log('Ignoring duplicate real-time insert for existing item:', payload.new.id);
    }
}

function handleRealtimeUpdate(payload) {
    const existingItem = canvas.querySelector(`[data-id="${payload.new.id}"]`);
    if (existingItem && existingItem !== selectedItem && !isDragging) {
        updateItemFromData(existingItem, payload.new);
        AppGlobals.showStatus('Item updated by another user');
    }
}

function handleRealtimeDelete(payload) {
    const existingItem = canvas.querySelector(`[data-id="${payload.old.id}"]`);
    if (existingItem && existingItem !== selectedItem) {
        // Add exit animation
        existingItem.style.transition = 'opacity var(--transition-normal), transform var(--transition-normal)';
        existingItem.style.opacity = '0';
        existingItem.style.transform = existingItem.style.transform + ' scale(0.8)';
        
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
            
            setTimeout(() => {
                item.style.transition = 'opacity var(--transition-normal), transform var(--transition-normal)';
                item.style.opacity = '1';
                item.style.transform = item.style.transform.replace('scale(0.8)', 'scale(1)');
            }, 10);
        }
    }
    
    return item;
}

function updateItemFromData(item, data) {
    const itemType = data.item_type;
    
    // Update position and dimensions
    item.style.left = data.x + 'px';
    item.style.top = data.y + 'px';
    if (data.width) item.style.width = data.width + 'px';
    if (data.height) item.style.height = data.height + 'px';
    if (data.z_index) item.style.zIndex = data.z_index;
    if (data.rotation !== undefined) item.dataset.rotation = data.rotation;
    if (data.border_radius !== undefined) item.style.setProperty('--item-border-radius', data.border_radius + 'px');
    
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
                    document.getElementById('strokeColor').value = path.getAttribute('stroke') || '#333333';
                    document.getElementById('strokeThickness').value = path.getAttribute('stroke-width') || '4';
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
    switch (item.dataset.type) {
        case 'image':
            return item.querySelector('img').src;
        case 'video':
            return item.querySelector('video').src;
        case 'text':
            return item.textContent;
        case 'code':
            return item.querySelector('iframe').srcdoc;
        case 'drawing':
            return item.querySelector('path').getAttribute('d');
        default:
            return '';
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
    getItemContent
};