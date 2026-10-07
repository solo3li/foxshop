#!/usr/bin/env bash
set -e

# ==============================================================================
# FoxShop - OSRM Egypt Map Data Preparation Script
# Downloads Egypt OSM extract from Geofabrik and processes OSRM driving graph.
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$PROJECT_ROOT/osrm_data"
PBF_URL="https://download.geofabrik.de/africa/egypt-latest.osm.pbf"
PBF_FILE="$DATA_DIR/egypt-latest.osm.pbf"
OSRM_IMAGE="ghcr.io/project-osrm/osrm-backend:latest"

echo "📍 [FoxShop] Preparing OSRM Egypt Map in: $DATA_DIR"
mkdir -p "$DATA_DIR"

if [ ! -f "$PBF_FILE" ]; then
    echo "⬇️ [1/4] Downloading Egypt OSM PBF from Geofabrik (~120 MB)..."
    if command -v curl &> /dev/null; then
        curl -L -o "$PBF_FILE" "$PBF_URL"
    elif command -v wget &> /dev/null; then
        wget -O "$PBF_FILE" "$PBF_URL"
    else
        echo "❌ Error: Neither curl nor wget is installed."
        exit 1
    fi
else
    echo "✅ [1/4] Egypt OSM PBF already exists at $PBF_FILE"
fi

echo "⚙️ [2/4] Extracting OSRM road graph (Car Profile)..."
docker run -t -v "$DATA_DIR:/data" "$OSRM_IMAGE" osrm-extract -p /opt/car.lua /data/egypt-latest.osm.pbf

echo "🧩 [3/4] Partitioning graph cells (MLD)..."
docker run -t -v "$DATA_DIR:/data" "$OSRM_IMAGE" osrm-partition /data/egypt-latest.osrm

echo "🎯 [4/4] Customizing graph weights..."
docker run -t -v "$DATA_DIR:/data" "$OSRM_IMAGE" osrm-customize /data/egypt-latest.osrm

echo "🚀 [FoxShop] OSRM Egypt Graph is ready! You can now start 'docker compose up -d osrm'."
