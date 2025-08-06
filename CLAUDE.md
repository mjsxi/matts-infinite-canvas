# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a web-based collaborative infinite canvas application that allows and admin users to add images and text objects to a shared canvas in real-time. The canvas supports panning, zooming, and real-time collaboration through Supabase.

## Architecture

### Frontend (Vanilla JS)
- **Supabase**: Real-time database and file storage for persistence and collaboration
- **index.html**: Main HTML structure with modals for user input
- **canvas.js**: Core application logic (~815 lines)
- **mobile-zoom-limits.js**: Contains restraints for mobile to make the canvas work
- **style.css**: Complete styling with responsive design and animations
- **mobile-zoom.css**: Contains tweaks that are just for mobiles canvas

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

```bash
# Option 1: Simple HTTP server
python -m http.server 8000
# Then open http://localhost:8000

# Option 2: Node.js http-server
npx http-server
```

### No Build Process
This project uses vanilla web technologies with CDN-loaded dependencies:
- Supabase client loaded from cdn.jsdelivr.net

### Key Configuration
- **Supabase credentials**: Located in script.js:2-3 (SUPABASE_URL, SUPABASE_KEY)
- **Admin password**: Located in script.js:19 (ADMIN_PASSWORD)

### Debuggin
When debugging (creating console logs, etc) create a new file to add to index.html to prevent code contamination.
Only add things to the main html, css, js files when asked directly to while trying to solve debugging issues.

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
  - `fontWeight` (`font_weight`): Font weight (e.g. `normal`, `bold`)  
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