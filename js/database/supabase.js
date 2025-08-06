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
    
    // Debug: Log what type of item we're trying to save
    console.log('Attempting to save item:', {
        type: item.dataset.type,
        id: item.dataset.id,
        isTextItem,
        isDrawingItem
    });
    
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

    // Debug: Log the content being extracted
    console.log('Item content extracted:', {
        type: item.dataset.type,
        content: itemData.content,
        contentLength: itemData.content ? itemData.content.length : 0
    });

    // Remove null values to avoid unnecessary database columns
    Object.keys(itemData).forEach(key => {
        if (itemData[key] === null || itemData[key] === undefined) {
            delete itemData[key];
        }
    });

    // Debug: Log the final data being sent to database
    console.log('Saving item data to database:', {
        id: itemData.id,
        type: itemData.item_type,
        x: itemData.x,
        y: itemData.y,
        content: itemData.content ? itemData.content.substring(0, 100) + '...' : null,
        hasContent: !!itemData.content
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
            console.error('Failed item data:', itemData);
            AppGlobals.showStatus('Failed to save item - check console for details');
            throw error;
        }

        console.log('Item saved successfully:', itemData.id, 'Type:', itemData.item_type);
    } catch (error) {
        console.error('Error saving item to database:', error);
        console.error('Failed item data:', itemData);
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
                            console.log('Video autoplay prevented for loaded video');
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
    console.log('Getting content for item:', {
        type: item.dataset.type,
        id: item.dataset.id
    });
    
    let content = '';
    switch (item.dataset.type) {
        case 'image':
            const img = item.querySelector('img');
            content = img ? img.src : '';
            console.log('Image content:', { src: content, hasImg: !!img });
            break;
        case 'video':
            const video = item.querySelector('video');
            content = video ? video.src : '';
            console.log('Video content:', { src: content, hasVideo: !!video });
            break;
        case 'text':
            content = item.textContent;
            console.log('Text content:', { content: content.substring(0, 50) + '...', length: content.length });
            break;
        case 'code':
            const iframe = item.querySelector('iframe');
            content = iframe ? iframe.srcdoc : '';
            console.log('Code content:', { content: content.substring(0, 50) + '...', length: content.length, hasIframe: !!iframe });
            break;
        case 'drawing':
            const path = item.querySelector('path');
            content = path ? path.getAttribute('d') : '';
            console.log('Drawing content:', { content: content.substring(0, 50) + '...', length: content.length, hasPath: !!path });
            break;
        default:
            content = '';
            console.log('Unknown item type:', item.dataset.type);
    }
    
    console.log('Final content for', item.dataset.type, ':', {
        content: content.substring(0, 100) + '...',
        length: content.length,
        isEmpty: !content
    });
    
    return content;
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