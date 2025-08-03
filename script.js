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

// Image styling variables - easy to customize
const IMAGE_STYLING = {
    shadowColor: 'rgba(0, 0, 0, 0.5)',
    shadowBlur: 20,
    shadowOffsetX: 0,
    shadowOffsetY: 8
};

// Admin password (change this!)
const ADMIN_PASSWORD = 'canvas123';

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeCanvas();
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
    canvas = new fabric.Canvas('canvas', {
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: '#ffffff',
        preserveObjectStacking: true
    });

    // Make canvas infinite by allowing panning
    canvas.on('mouse:wheel', function(opt) {
        const delta = opt.e.deltaY;
        let zoom = canvas.getZoom();
        zoom *= 0.999 ** delta;
        if (zoom > 20) zoom = 20;
        if (zoom < 0.01) zoom = 0.01;
        canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
        opt.e.preventDefault();
        opt.e.stopPropagation();
    });

    // Pan on middle mouse button or when no object is selected
    canvas.on('mouse:down', function(opt) {
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
        updateCanvasItem(e.target);
    });
    
    // Handle object scaling (resizing)
    canvas.on('object:scaling', function(e) {
        // Update in real-time while scaling
        updateCanvasItem(e.target);
    });
    
    canvas.on('object:scaled', function(e) {
        // Update when scaling is finished
        updateCanvasItem(e.target);
    });
    
    // Handle object moving
    canvas.on('object:moving', function(e) {
        // Update in real-time while moving
        updateCanvasItem(e.target);
    });
    
    canvas.on('object:moved', function(e) {
        // Update when moving is finished
        updateCanvasItem(e.target);
    });
    
    // Handle object rotating
    canvas.on('object:rotating', function(e) {
        // Update in real-time while rotating
        updateCanvasItem(e.target);
    });
    
    canvas.on('object:rotated', function(e) {
        // Update when rotating is finished
        updateCanvasItem(e.target);
    });
    
    // Handle text editing
    canvas.on('text:changed', function(e) {
        updateCanvasItem(e.target);
    });
    
    canvas.on('text:editing:exited', function(e) {
        updateCanvasItem(e.target);
    });

    // Handle object selection for permissions and z-index controls
    canvas.on('selection:created', function(e) {
        checkObjectPermissions(e.selected[0]);
        toggleZIndexControls(true);
    });

    canvas.on('selection:updated', function(e) {
        checkObjectPermissions(e.selected[0]);
        toggleZIndexControls(true);
    });
    
    canvas.on('selection:cleared', function() {
        toggleZIndexControls(false);
    });

    // Resize canvas on window resize
    window.addEventListener('resize', function() {
        canvas.setDimensions({
            width: window.innerWidth,
            height: window.innerHeight
        });
    });
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
    
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('canvas_user_id', userId);
        console.log('Generated new userId:', userId);
    }
    
    if (!userNickname) {
        console.log('No nickname found, showing user modal');
        showUserModal();
    } else {
        console.log('Nickname found, updating user info');
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
    document.getElementById('addTextBtn').addEventListener('click', showTextModal);
    document.getElementById('adminBtn').addEventListener('click', showAdminModal);
    document.getElementById('setCenterBtn').addEventListener('click', toggleSetCenter);
    document.getElementById('clearCanvasBtn').addEventListener('click', clearCanvas);
    document.getElementById('fileInput').addEventListener('change', handleFileUpload);
    document.getElementById('bringToFrontBtn').addEventListener('click', bringToFront);
    document.getElementById('sendToBackBtn').addEventListener('click', sendToBack);
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
        localStorage.setItem('canvas_user_nickname', nickname);
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
        showStatus('Admin mode activated (24h session)', 'success');
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
    showStatus('Admin logout successful', 'success');
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
        showStatus('Click anywhere to set center point', 'success');
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
                id: 1,
                x: point.x,
                y: point.y,
                is_active: true,
                updated_at: new Date().toISOString()
            });
        
        if (error) throw error;
        
        showCenterIndicator(point.x, point.y);
        showStatus('Center point updated!', 'success');
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
            left: canvas.getCenter().left,
            top: canvas.getCenter().top,
            originX: 'center',
            originY: 'center'
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
function showTextModal() {
    document.getElementById('textModal').classList.remove('hidden');
    document.getElementById('textInput').focus();
}

function closeTextModal() {
    document.getElementById('textModal').classList.add('hidden');
    document.getElementById('textInput').value = '';
}

function addTextToCanvas() {
    const text = document.getElementById('textInput').value.trim();
    if (!text) return;
    
    const textObj = new fabric.IText(text, {
        left: canvas.getCenter().left,
        top: canvas.getCenter().top,
        fontFamily: 'Arial',
        fontSize: 24,
        fill: '#333333',
        originX: 'center',
        originY: 'center'
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
    
    // Save to database and get the ID
    saveCanvasItem(textObj, text);
    
    closeTextModal();
}

// Database Functions
async function saveCanvasItem(fabricObject, content) {
    try {
        const { data, error } = await supabaseClient
            .from('canvas_items')
            .insert({
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
                z_index: canvas.getObjects().indexOf(fabricObject)
            })
            .select()
            .single();
        
        if (error) throw error;
        
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
        
        console.log('Updating item:', {
            id: fabricObject.customId,
            type: fabricObject.itemType,
            content: content,
            x: fabricObject.left,
            y: fabricObject.top
        });
        
        const { error } = await supabaseClient
            .from('canvas_items')
            .update({
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
                updated_at: new Date().toISOString()
            })
            .eq('id', fabricObject.customId);
        
        if (error) throw error;
        
        console.log('Item updated successfully');
        
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
                    width: item.width,
                    height: item.height,
                    angle: item.rotation
                });
                
                // Apply styling to image
                applyImageStyling(fabricImg);
                
                // Add custom properties
                fabricImg.customId = item.id;
                fabricImg.userId = item.user_id;
                fabricImg.itemType = item.item_type;
                fabricImg.originalWidth = item.original_width;
                fabricImg.originalHeight = item.original_height;
                fabricImg.aspectRatio = item.aspect_ratio;
                
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
            const textObj = new fabric.IText(item.content, {
                left: item.x,
                top: item.y,
                width: item.width,
                height: item.height,
                angle: item.rotation,
                fontSize: 24,
                fill: '#333333'
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
            
            showStatus('Canvas cleared', 'success');
            
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
        existingObj.set({
            left: itemData.x,
            top: itemData.y,
            width: itemData.width,
            height: itemData.height,
            angle: itemData.rotation
        });
        canvas.requestRenderAll();
    }
}

function removeItemFromCanvas(itemId) {
    const objects = canvas.getObjects();
    const objToRemove = objects.find(obj => obj.customId === itemId);
    
    if (objToRemove) {
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

function bringToFront() {
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
        canvas.bringObjectToFront(activeObject);
        // Update all objects to ensure z-index is correct
        canvas.getObjects().forEach((obj, index) => {
            if (obj.customId) {
                updateCanvasItem(obj);
            }
        });
        showStatus('Brought to front', 'success');
    }
}

function sendToBack() {
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
        canvas.sendObjectToBack(activeObject);
        // Update all objects to ensure z-index is correct
        canvas.getObjects().forEach((obj, index) => {
            if (obj.customId) {
                updateCanvasItem(obj);
            }
        });
        showStatus('Sent to back', 'success');
    }
}

// Image styling functions
function applyImageStyling(fabricImg) {
    // Apply shadow
    fabricImg.set({
        shadow: new fabric.Shadow({
            color: IMAGE_STYLING.shadowColor,
            blur: IMAGE_STYLING.shadowBlur,
            offsetX: IMAGE_STYLING.shadowOffsetX,
            offsetY: IMAGE_STYLING.shadowOffsetY
        })
    });
}

function updateAllImageStyling() {
    const objects = canvas.getObjects();
    objects.forEach(obj => {
        if (obj.itemType === 'image') {
            applyImageStyling(obj);
        }
    });
    canvas.requestRenderAll();
    showStatus('Updated all image styling', 'success');
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
    // Delete selected object (if user owns it or is admin)
    if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeObj = canvas.getActiveObject();
        if (activeObj && (activeObj.userId === userId || isAdmin)) {
            deleteCanvasItem(activeObj);
        }
    }
    
    // Escape to cancel center setting
    if (e.key === 'Escape' && isSettingCenter) {
        toggleSetCenter();
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
        
        canvas.remove(fabricObject);
        showStatus('Item deleted', 'success');
        
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