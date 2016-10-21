FOR %%G IN (*.csv) DO (
  iconv -f cp1254 -t utf-8 %%G > %%~nG.txt
)

TYPE info.txt | csvjson |  jq "map({(.Unique): .}) | add " > info.json
DEL info.txt

FOR %%G IN (opgee_run*.txt) DO (
  TYPE %%G | csvjson | jq "map({(.Unique): del(.Run)}) | add " > %%~nG.json
  DEL %%G
)

FOR %%G IN (prelim_run*.txt) DO (
  TYPE %%G | csvjson | jq "map({(.Unique): del(.Run)}) | add " > %%~nG.json
  DEL %%G
)

TYPE metadata.txt | csvjson | jq ".[]" > metadata.json
DEL metadata.txt
