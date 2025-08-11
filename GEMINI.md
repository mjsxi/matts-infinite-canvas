# GEMINI.md

This file provides guidance to Gemini Code  when working with code in this repository.

## Project Overview

This is a web-based collaborative infinite canvas application that allows and admin users to add images and text objects to a shared canvas in real-time. The canvas supports panning, zooming, and real-time collaboration through Supabase.

## Architecture

### Frontend (Modular Vanilla JS)
- **Supabase**: Real-time database and file storage for persistence and collaboration
- **index.html**: Main HTML structure with modals for user input
- **Modular JavaScript Structure**: Organized into focused modules prefer approach when applicable
- **mobile-zoom-limits.js**: Contains restraints for mobile to make the canvas work
- **style.css**: Complete styling with responsive design and animations
- **mobile-zoom.css**: Contains tweaks that are just for mobiles canvas

### JavaScript Module Structure
```
js/
├── core/
│   ├── viewport.js        # Coordinate transformations, zoom/pan (6 functions)
│   └── events.js          # Mouse, touch, keyboard handling (12 functions)
├── items/
│   ├── manager.js         # Selection, drag/drop, resize (12 functions)
│   └── creators.js        # Item creation factories (8 functions)
├── database/
│   └── supabase.js        # All database operations (15 functions)
├── ui/
│   └── toolbars.js        # Toolbar & modal management (20 functions)
├── features/
│   └── drawing.js         # Drawing functionality (7 functions)
├── auth/
│   └── admin.js           # Authentication & admin features (15 functions)
├── utils/
│   └── performance.js     # Utilities & performance tools (15 functions)
└── main.js               # Application coordinator & global state
```

### Module Dependencies
- **main.js**: Initializes all modules and manages global state
- **Core modules**: Provide fundamental canvas operations
- **Feature modules**: Build on core functionality for specific features
- **UI modules**: Handle user interface and interactions
- **Database module**: Manages all persistence and real-time sync

### Key Components
- **Canvas Management**: Infinite panning/zooming with mouse wheel and drag interactions
- **Object System**: Images and text objects with custom properties (customId, userId, itemType)
- **Admin System**: Password-protected admin mode
- **Real-time Sync**: Supabase real-time subscriptions for live collaboration
- **Center Point**: Admin-configurable canvas center point for navigation

### Database Schema (Supabase)
- `canvas_items`: Stores all canvas objects (images/text) with position, size, rotation
- `canvas_center`: Stores the designated center point of the canvas

## Development Workflow

### Running the Application
Since this is a vanilla HTML/CSS/JS application, simply open `index.html` in a web browser or serve it with a local web server:

### Test with localhost
Assume there is always a project running on localhost http://localhost:3000 if you need to test

### No Build Process
This project uses vanilla web technologies with CDN-loaded dependencies:
- Supabase client loaded from cdn.jsdelivr.net

### Key Configuration
- **Supabase credentials**: Located in js/main.js:31-32 (SUPABASE_URL, SUPABASE_KEY)
- **Admin password**: Located in js/main.js:30 (ADMIN_PASSWORD)

### Modular Development Workflow

#### Working with Modules
- **Core changes**: Modify viewport.js or events.js for fundamental canvas behavior
- **Feature additions**: Add new modules in appropriate directories (features/, ui/, etc.)
- **Database changes**: All persistence logic isolated in database/supabase.js
- **UI updates**: Toolbar and interface changes go in ui/toolbars.js

#### Module Communication
- **Global state**: Managed through window object (container, canvas, selectedItem, etc.)
- **Cross-module calls**: Use ModuleName.functionName() pattern
- **Event delegation**: Events bound in events.js, delegated to appropriate modules

#### Debugging
When debugging (creating console logs, etc) create a new file to add to index.html to prevent code contamination.
Only add things to the main html, css, js files when asked directly to while trying to solve debugging issues.

#### File Backup
- **Original monolith**: Backed up as canvas.js.backup (27k+ lines)
- **Load order**: Modules must load in dependency order (see index.html)

## Code Architecture Details

### Canvas Object System  
All canvas objects (images / text) include these custom properties:

- `customId` (`id`): Unique identifier for database sync  
- `userId` (`user_id`): Owner identification for permissions  
- `itemType` (`item_type`): `'image'` or `'text'`  
- `content` (`content`): Image URL or plain‐text content for text objects  
- `htmlContent` (`html_content`): Raw HTML markup for rich‐text items  
- `x` (`x`): X-coordinate position on the canvas  
- `y` (`y`): Y-coordinate position on the canvas  
- `width` (`width`): Display width after scaling  
- `height` (`height`): Display height after scaling  
- `originalWidth` / `originalHeight` (`original_width` / `original_height`): Source dimensions for aspect-ratio preservation  
- `aspectRatio` (`aspect_ratio`): Calculated width÷height ratio for proper scaling  
- `rotation` (`rotation`): Rotation angle in degrees  
- `zIndex` (`z_index`): Stacking order (which object sits on top)  
- `borderRadius` (`border_radius`): Corner-rounding radius for images or shape backgrounds  
- **Text-only properties**  
  - `fontFamily` (`font_family`): Font family name (e.g. `Sans-serif`)  
  - `fontSize` (`font_size`): Font size in px (e.g. `24`)  
  - `fontWeight` (`font_weight`): Font weight (e.g. `400`, `700`)  
  - `fontVariation` (`font_variation`): Font variations (e.g. `Weight: 450, Width: 100, CNTR: 50`)  
  - `textColor` (`text_color`): Color value (hex, rgb, etc.)  
  - `lineHeight` (`line_height`): Line-height multiplier (e.g. `1.15`)
- **Stroke-only properties** 
  - `strokeThickness` (`stroke_thickness`): Stroke size in px (e.g. `4`)
  - `StrokeColor` (`stroke_color`): Color value (hex, rgb, etc.)  

### Real-time Architecture
- Uses Supabase real-time subscriptions for INSERT/UPDATE/DELETE on canvas_items
- Prevents local user from receiving their own updates
- Center point changes broadcast to all users

### Admin Features
- 24-hour session persistence in localStorage
- Center point setting with visual indicator
- Canvas clearing capability
- Enhanced object permissions

## Important Implementation Notes

### Object Persistence
- Objects are saved to Supabase immediately upon creation
- Modifications trigger UPDATE queries with current transform state
- Deletion removes from both canvas and database

### Canvas Coordinates
- Center point calculation accounts for viewport transform
- Real-time updates preserve object positioning across users

### User Session Management
- User IDs generated client-side and stored in localStorage
- Nicknames required before canvas interaction
- Admin sessions expire automatically after 24 hours

### File Upload
- Images uploaded to Supabase Storage bucket 'canvas-media'
- Public URLs generated for canvas object sources
- Files resized to 100px height maintaining aspect ratio

## Browser Compatibility
- Requires modern browser with Canvas API support
- Uses CSS backdrop-filter (may need fallbacks for older browsers)
- Real-time features require WebSocket support