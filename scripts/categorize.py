"""
Architectural categorization for Toronto buildings.

Combines OSM building tags (where a footprint matched) with the 3D Massing height
and footprint area to assign each building a category that drives its facade style
and material palette in the renderer. Kept deliberately small so the shader can
branch on a single integer code.
"""
from __future__ import annotations

# Category code -> name. The renderer maps these codes to facade styles/palettes.
CATEGORIES = [
    "glass_tower",       # 0  office/commercial curtain-wall tower
    "residential_tower", # 1  condo/apartment tower (smaller windows, balconies)
    "office_midrise",    # 2  mid-rise office / commercial
    "masonry_lowrise",   # 3  low-rise retail / commercial / mixed masonry
    "institutional",     # 4  civic / stone / stadium / station
    "house",             # 5  detached / small residential
    "utility",           # 6  parking / industrial / warehouse
]
CODE = {name: i for i, name in enumerate(CATEGORIES)}

_RESIDENTIAL = {"apartments", "residential", "house", "detached", "terrace",
                "dormitory", "hotel", "semidetached_house", "bungalow"}
_OFFICE = {"office", "commercial"}
_RETAIL = {"retail", "supermarket", "kiosk", "mall"}
_INSTITUTIONAL = {"civic", "public", "government", "university", "college",
                  "school", "hospital", "church", "cathedral", "chapel",
                  "stadium", "train_station", "transportation", "museum"}
_UTILITY = {"industrial", "warehouse", "parking", "garage", "garages",
            "service", "shed", "construction"}
_INST_AMENITY = {"place_of_worship", "townhall", "university", "hospital",
                 "school", "college", "courthouse", "library", "theatre"}


def categorize(tags: dict, height: float, area: float) -> int:
    """Return a category CODE from OSM tags + height (m) + footprint area (m^2)."""
    b = (tags.get("building") or "").lower()
    amenity = (tags.get("amenity") or "").lower()
    shop = tags.get("shop")
    office = tags.get("office")

    is_residential = b in _RESIDENTIAL
    is_office = b in _OFFICE or bool(office)
    is_retail = b in _RETAIL or bool(shop)
    is_institutional = b in _INSTITUTIONAL or amenity in _INST_AMENITY
    is_utility = b in _UTILITY or amenity == "parking"

    if is_institutional:
        return CODE["institutional"]
    if is_utility:
        return CODE["utility"]

    # Height-driven tiers, split residential vs commercial.
    if height >= 55:
        return CODE["residential_tower"] if is_residential else CODE["glass_tower"]
    if height >= 22:
        return CODE["residential_tower"] if is_residential else CODE["office_midrise"]
    # low-rise
    if b in {"house", "detached", "bungalow", "semidetached_house"} or (area < 300 and height < 12 and not is_retail):
        return CODE["house"]
    return CODE["masonry_lowrise"]


def category_name(code: int) -> str:
    return CATEGORIES[code] if 0 <= code < len(CATEGORIES) else "unknown"
