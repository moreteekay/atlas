MORETEEKAY ATLAS FINAL ENGINE

Files:
- index.html
- style.css
- app.js
- config.js
- data/places.csv
- data/content.csv
- data/photos.csv

How updates work:
1. The engine works immediately with the CSV files in the data folder.
2. Publish the Places, Content Library and Photos tabs from Google Sheets as CSV.
3. Paste the three CSV URLs into config.js once.
4. After that, edit Google Sheets only. The map reads the latest published data whenever it loads.

The code does not contain any city, landmark, river or monument names.
New rows appear automatically as long as they use the same columns.
