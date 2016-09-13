TYPE info.csv | csvjson |  jq "map({(.Unique): .}) | add | { info: . }" > info.json


FOR %%G IN (opgee_run*.csv) DO (
  TYPE %%G | csvjson | jq "map({(.Unique): .}) | add | { (.[keys[0]].Run): del(.[].Run)}" >> temp_opgee.json
)

TYPE temp_opgee.json | jq --slurp "add | { opgee: . } " > opgee.json

DEL temp_opgee.json

FOR %%G IN (prelim_run*.csv) DO (
  TYPE %%G | csvjson | jq "map({(.Unique): .}) | add | { (.[keys[0]].Run): del(.[].Run)}" >> temp_prelim.json
)

TYPE temp_prelim.json | jq --slurp "add | { prelim: . }" > prelim.json

DEL temp_prelim.json

TYPE metadata.csv | csvjson | jq "{ metadata: .[]}" > metadata.json

TYPE lhv.csv | csvjson | jq "{ lhv: .[]}" > lhv.json

TYPE info.json opgee.json prelim.json metadata.json lhv.json | jq --slurp "add" > oils.json

DEL info.json opgee.json prelim.json metadata.json lhv.json
