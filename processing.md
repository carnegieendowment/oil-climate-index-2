## File Modifications

Perform these steps on the OCI Consolidated Sheet to prepare it for data updating. This only needs to be performed once.

- Add the macro
  - Open the VBA editor (Alt+F11 or click VBA editor on the Developers Tab)
  - Right click the project --> Insert --> Module
  - Copy macro text (`macro.txt`)
- Add two columns (A, B)
- Set slider values in column A
  - Macro will only look in A41, A69, A85 (Solar Steam, Water, Flaring)
  - Example values (start everything with the default):
    - A41: 0, 0.15, 0.3, 0.5
    - A69: 1, 0.1, 0.75, 1.25
    - A85: 1, 0.5, 0.75, 1.25, 1.5
  - Make sure these are the same values used in the special cases sheets (order doesn't matter though, it matches dynamically)
- Add a "tag" indicating the start of the special oils in row D; any text will work

## Data Processing (creating new data for the site)

- Install [python](https://www.python.org/downloads/), [csvkit](http://csvkit.readthedocs.org/en/0.9.1/install.html#users), and [jq](http://stedolan.github.io/jq/download/); add each to the [path/environment variables](http://www.computerhope.com/issues/ch000549.htm) as you go.
- Open the prepared file (see above)
- Run the macro
  - Select OPGEE model when prompted
- Close without saving
- Perform any special processing (see below)
- Run processing script (`process.bat`)
- Final data will be named `oils.json`; replace the old file with this name on the website ([on the master branch in `/data` folder]()

## Special processing

- Add the unique oil name into cell D2 (used for matching with the rest of the data)
- Copy in special processing macro (`special_macro.txt')
- Run macro for each special oil
  - Select (prepped) OCI Consolidated Sheet when prompted
  - Slider values should be column H, rows 163-5 (in order: Solar Steam, Water, Flaring)
  - Macro will only grab the first `n` columns start at column H where `n` is equal to `solar_steam_options * water_options * flaring_options` (currently 80)
- Close without saving
