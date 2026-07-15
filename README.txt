MORETEEKAY ATLAS — FINAL CLEAN ENGINE

Upload these files to the root of the GitHub atlas repository:
- index.html
- app.js
- style.css
- config.js

Keep the existing data folder.

CONTENT LIBRARY — EXACT COLUMNS
Content ID | Type | Title | Status | URL | Atlas ID

Example:
ART001 | Essay | Neighbor: ... | Published | https://... | ATL-0195

The Atlas ID must exactly match the place's Atlas ID in Places.
One article may be linked to several places by separating Atlas IDs with commas.

PHOTOS — REQUIRED COLUMNS
Photo ID | Atlas ID | Photo URL | Caption | Hero?

Optional columns such as Display Order, Alt Text, Credit, Status and Private Notes
are supported and ignored when not needed.

PLACES
The engine continues to read the current Places sheet structure.

The code supports both:
1. Direct content linking through Content Library > Atlas ID, which is the preferred method.
2. The older Places > Related Content IDs field, as a compatibility fallback.

Only content with Status = Published appears publicly.
Empty article, podcast and photo sections remain hidden.
