"""
Shared configuration for the GTA: THE 6 Toronto data pipeline.

All geographic constants live here so the download + processing scripts agree,
and so the playable area can be moved / resized or expanded to new Toronto
neighbourhoods later without touching pipeline logic.
"""

# ---------------------------------------------------------------------------
# Playable area
# ---------------------------------------------------------------------------
# Centre of the local coordinate system (x=0, z=0 in the Three.js world).
# Chosen at the CN Tower so the player spawns right next to it; the box
# reaches north into the Entertainment District and west over Rogers Centre.
CN_TOWER_LAT = 43.6426
CN_TOWER_LON = -79.3871

# We nudge the clip-box centre slightly north + west of the CN Tower so the
# 700 m square captures Rogers Centre and a good slice of the Entertainment
# District / downtown street grid, not just the lakeshore south of the tower.
AREA_CENTER_LAT = 43.6440
AREA_CENTER_LON = -79.3888

# Edge length of the (square) playable area, in metres.
AREA_SIZE_M = 700.0

# Player spawn offset from the CN Tower, in local metres (+x east, +z south).
# Spawn on the Bremner Boulevard sidewalk southeast of the tower so the first
# view includes the street grid rather than opening in the middle of Roundhouse
# Park. The point is ~5 m off the road centreline and clear of building footprints.
SPAWN_OFFSET_X = 34.0
SPAWN_OFFSET_Z = 96.0
# Player/camera heading in radians; negative yaw aims northeast along Bremner.
SPAWN_YAW = -0.88

# Extra margin (metres) fetched around the clip box for raw downloads, so
# linear features (roads) are not truncated right at the boundary.
FETCH_MARGIN_M = 80.0

# ---------------------------------------------------------------------------
# Projection helpers (WGS84 <-> local tangent-plane metres)
# ---------------------------------------------------------------------------
# World units are METRES. We use a simple equirectangular (tangent-plane)
# projection centred on AREA_CENTER_*. Over a <1 km area this is accurate to
# well under a metre, and keeps the toolchain dependency-free (no pyproj).
import math

_EARTH_R = 6378137.0  # WGS84 semi-major axis (metres)
_LAT0 = math.radians(AREA_CENTER_LAT)
_METERS_PER_DEG_LAT = (math.pi / 180.0) * _EARTH_R
_METERS_PER_DEG_LON = (math.pi / 180.0) * _EARTH_R * math.cos(_LAT0)


def lonlat_to_local(lon: float, lat: float) -> tuple[float, float]:
    """WGS84 lon/lat (degrees) -> local (x_east, z_south) metres.

    Returns (x, z) where +x is EAST and +z is SOUTH. We flip the north axis
    into +z=south so the pair maps directly onto the Three.js convention used
    by the renderer: ground plane = XZ, with world +Z pointing south.
    """
    x = (lon - AREA_CENTER_LON) * _METERS_PER_DEG_LON
    north = (lat - AREA_CENTER_LAT) * _METERS_PER_DEG_LAT
    z = -north
    return x, z


def webmercator_to_lonlat(x: float, y: float) -> tuple[float, float]:
    """EPSG:3857 (Web Mercator metres) -> WGS84 lon/lat degrees.

    The City of Toronto 3D Massing shapefile ships its geometry in Web
    Mercator (EPSG:3857) despite the 'WGS84' filename, so building vertices
    must pass through here first.
    """
    lon = (x / _EARTH_R) * (180.0 / math.pi)
    lat = (2.0 * math.atan(math.exp(y / _EARTH_R)) - math.pi / 2.0) * (180.0 / math.pi)
    return lon, lat


def area_bounds_lonlat(margin_m: float = 0.0) -> tuple[float, float, float, float]:
    """Return (min_lon, min_lat, max_lon, max_lat) for the clip box.

    `margin_m` expands the box on every side (used for raw fetches).
    """
    half = AREA_SIZE_M / 2.0 + margin_m
    dlat = half / _METERS_PER_DEG_LAT
    dlon = half / _METERS_PER_DEG_LON
    return (
        AREA_CENTER_LON - dlon,
        AREA_CENTER_LAT - dlat,
        AREA_CENTER_LON + dlon,
        AREA_CENTER_LAT + dlat,
    )


def area_bounds_local() -> tuple[float, float, float, float]:
    """Return clip box in local metres as (min_x, min_z, max_x, max_z)."""
    half = AREA_SIZE_M / 2.0
    return (-half, -half, half, half)


# ---------------------------------------------------------------------------
# Data source URLs (recorded for attribution + reproducible downloads)
# ---------------------------------------------------------------------------
TORONTO_3D_MASSING_SHP_URL = (
    "https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/"
    "387b2e3b-2a76-4199-8b3b-0b7d22e2ec10/resource/"
    "667237d6-4d3c-4cf3-8cb7-e91c48d59375/download/"
    "3dmassingshapefile_2025_wgs84.zip"
)

# Public Overpass mirrors, tried in order. The main overpass-api.de endpoint is
# frequently at capacity, so community mirrors are listed first.
OVERPASS_ENDPOINTS = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass-api.de/api/interpreter",
]

HTTP_USER_AGENT = "gta6-toronto/1.0 (dev; contact work.youseph@gmail.com)"
