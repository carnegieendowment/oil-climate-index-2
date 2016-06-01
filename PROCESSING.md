Below are instructions for using the OCI Consolidated Workbook plus an OPGEE model workbook to update data for the site.

## Data Processing (creating new data for the site)

1. Install [python](https://www.python.org/downloads/), [csvkit](http://csvkit.readthedocs.org/en/0.9.1/install.html#users), and [jq](http://stedolan.github.io/jq/download/); add each to the [path/environment variables](http://www.computerhope.com/issues/ch000549.htm) as you go.
2. Open the prepared file, a slightly modified version of the OCI Consolidated workbook (see below)
3. Run the macro
  1. Select OPGEE model when prompted
4. **Close without saving**
5. Perform any special processing (see below)
6. Run the processing script: `process.bat`
7. The final data will be named `oils.json`; replace the old file with this name on the website ([on the master branch in `app/assets/data` folder](https://github.com/carnegieendowment/oil-climate-index-2/tree/master/app/assets/data)

## OCI Consolidated Workbook File Modifications

Perform these steps on the OCI Consolidated Workbook (Sheet: OCI) to prepare it for data updating. This only needs to be performed once.

1. Add the macro
    1. Open the VBA editor (Alt+F11 or click VBA editor on the Developers Tab)
    2. Right click the project --> Insert --> Module
    3. Copy macro text [`macro.txt`](https://github.com/carnegieendowment/oil-climate-index-2/blob/master/macro.txt)
2. Add two columns to the beginning of the sheet (A, B)
3. Set slider values in column A
  1. Macro will only look in A41, A69, A85 (Solar Steam, Water, Flaring)
  2. Example values (start everything with the default):
    - A41: 0, 0.15, 0.3, 0.5
    - A69: 1, 0.1, 0.75, 1.25
    - A85: 1, 0.5, 0.75, 1.25, 1.5
  3. Make sure these are the same values used in the special cases sheets (order doesn't matter though, it matches dynamically)
4. Add a "tag" indicating the start of the special oils in row D; any text will work

Note: to skip a certain refinery run for a specific oil, add the corresponding refinery number (1-4, from row 1030) to row 23 in the oil's column.

## Special processing

1. Start with an prepared OPGEE model output workbook with results that correspond to the slider selections in the prepared file above. So for each permutation possible from the above step 3ii, we should have one run (Solar Steam 15%, Water 75%, Flaring 50%, see more below in step 4)
2. Add the unique oil name into cell D2 (used for matching with the rest of the data)
3. Copy in special processing macro [`special_macro.txt'](https://github.com/carnegieendowment/oil-climate-index-2/blob/master/special_macro.txt)
4. Run the macro for each special oil
  1. Slider values should be in column H, rows 163-5 (in order: Solar Steam, Water, Flaring)
  2. The macro will only grab the first `n` columns starting at column H where `n` is equal to `solar_steam_options * water_options * flaring_options` (currently 80)
  3. Select (prepped) OCI Consolidated Sheet when prompted
5. **Close without saving**
