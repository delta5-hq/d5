#!/bin/sh
CONFIG_FILE="/html/env-config.js"
INDEX_FILE="/html/index.html"
TEMPLATE_FILE="/html/index.html.template"
LOG_FILE="/tmp/env-config.log"

# Start log
echo "Starting env-config.sh script at $(date)" > "$LOG_FILE"

# Create env-config.js with BASE_URL
cat <<EOF > "$CONFIG_FILE"
window._env_ = {
  API_ROOT: "${API_ROOT}",
  BASE_URL: "${BASE_URL}"
};
EOF
echo "Created $CONFIG_FILE with BASE_URL='${BASE_URL}'" >> "$LOG_FILE"

# Create template from index.html only if template doesn't exist
if [ ! -e "$TEMPLATE_FILE" ]; then
  cp "$INDEX_FILE" "$TEMPLATE_FILE"
  echo "Created template file from index.html" >> "$LOG_FILE"
fi

# Start with a fresh copy of the template
cp "$TEMPLATE_FILE" "$INDEX_FILE"
echo "Restored index.html from template" >> "$LOG_FILE"

# Create a temporary file for sed operations
TMP_FILE=$(mktemp)

if [ -n "${BASE_URL}" ]; then
  echo "Processing URLs with BASE_URL='${BASE_URL}'" >> "$LOG_FILE"
  
  # First remove leading slashes from all root-relative URLs to make them work with base tag
  # This changes href="/path" to href="path" and src="/path" to src="path"
  sed -E 's/(href|src)="\//\1="/g' "$INDEX_FILE" > "$TMP_FILE"
  cp "$TMP_FILE" "$INDEX_FILE"
  
  # Then insert the base tag at the beginning of the head section
  sed -E "s|(<head>)|\\1\n  <base href=\"/${BASE_URL}/\">|" "$INDEX_FILE" > "$TMP_FILE"
  cp "$TMP_FILE" "$INDEX_FILE"
  
  echo "Successfully added base href='/${BASE_URL}/' and converted all URLs to relative format" >> "$LOG_FILE"
else
  echo "No BASE_URL set, adding root base tag" >> "$LOG_FILE"
  
  # Insert a base tag with root path for when BASE_URL is empty
  sed -E "s|(<head>)|\\1\n  <base href=\"/\">|" "$INDEX_FILE" > "$TMP_FILE"
  cp "$TMP_FILE" "$INDEX_FILE"
  
  echo "Successfully added base href='/' to ensure correct URL resolution" >> "$LOG_FILE"
fi

# Clean up
rm -f "$TMP_FILE"

# Set proper permissions so nginx can read the files
chmod 644 "$CONFIG_FILE" "$INDEX_FILE"
echo "Set permissions on generated files to ensure nginx can read them" >> "$LOG_FILE"

echo "env-config.sh completed successfully at $(date)" >> "$LOG_FILE"

exit 0