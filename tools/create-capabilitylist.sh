#!/bin/bash

# This script will extract all necessary data from Athom's capability list
# I used to include the node-homey library but I'm trying to reduce dependencies

if ! command -v git jq mktemp >/dev/null
then
	echo "I need command git, jq and mktemp"
	exit 1
fi

OUTPUTFILE="/tmp/allCapabilities.json"
TMPDIR="$(mktemp -d)"

echo "Using $TMPDIR"

cd "$TMPDIR"
git clone \
	--depth 1  \
	--filter=blob:none  \
	--sparse \
	https://github.com/athombv/node-homey-lib.git

cd node-homey-lib
git sparse-checkout set assets/capability/capabilities

cd assets/capability/capabilities/
jq -n 'reduce (
		inputs
			| { title, type, getable, setable, min, max, uiComponent }
			| with_entries( select( .value != null ) )
		)
		as $s (
			.;
			( .[ input_filename | rtrimstr(".json") ] )
			+= $s
		)' *.json > "$OUTPUTFILE"

echo -e "\nFind output in $OUTPUTFILE"