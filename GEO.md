### Geospatial data

The data which powers the maps in the site was generated from the CEIP-provided shapefile. This was reprojected to Web Mercator and saved as a GeoJSON ([oilfields.geojson](https://github.com/carnegieendowment/oil-climate-index-2/blob/master/app/assets/data/oilfields.geojson)). These fields are joined to each oil's data by using the `Field_Name` property from the shapefile and the `Oil Field Name (OPGEE)` property from the OCI Consolidated Workbook.

### Recreating the GeoJSON

1. [Install GDAL](http://sandbox.idre.ucla.edu/sandbox/tutorials/installing-gdal-for-windows) (Windows specific tutorial)
2. Run the following command from the terminal: `ogr2ogr -f GeoJSON -t_srs crs:84 oilfields.geojson source_shapefile`, inserting your shapefile name in place of `source_shapefile`.
3. Add to [`app/assets/data`](https://github.com/carnegieendowment/oil-climate-index-2/tree/master/app/assets/data) replacing the previous GeoJSON.

---

The current `Field_Name` properties are: `["Aboozar", "Agbami", "Alaska North Slope", "Average Tyra/Gorm", "Azeri", "Bakken", "Bombay High", "Bonga", "Bonny", "Bozhong", "Bul Hanine", "Burgan", "Cano Limon", "Cantarell", "Chayvo", "Chuc", "Cold Lake", "Cossack", "Cusiana", "Dukhan", "Duri", "Eagle Ford - Black oil", "Eagle Ford - Condensate", "Eagle Ford - Volatile oil", "East Texas Field", "Ekofisk", "Escravos Beach", "Fateh", "Forties Average", "Foster Creek", "Frade", "Ghawar", "Girassol", "Hamaca", "Hassi R'Mel", "Hibernia", "Kirkuk", "Kuito", "Lake Washington Field", "Leona", "Light Sweet SCO", "Lula", "Mars", "Marun", "Medium Sweet SCO", "Merey Blend", "Midale", "Midway-Sunset", "Minas", "Murban", "Nanhai Light", "North Sea Skarv", "Obagi", "Orinoco Oil Belt", "Oseberg", "Pennington", "QinHuangDao", "Ratawi", "Romashkinskoye", "Rumaila", "Sacha", "Safaniya", "Salt Creek", "Samotlor", "South Belridge", "Spraberry field", "Surmont", "Takula", "Tengiz", "Thunder Horse", "Tia Juana", "WC", "Waha", "West Qurna-2", "Wilmington-Duffy", "Yates", "Zubair", "Zuluf"]`
