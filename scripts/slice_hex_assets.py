from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
GENERATED = ROOT / "assets" / "generated"
PUBLIC_HEX = ROOT / "public" / "assets" / "game" / "hex"


TERRAIN_NAMES = [
    "plain",
    "forest",
    "mountain",
    "river",
    "farmland",
    "road",
    "lake",
    "wasteland",
    "hill",
    "pass",
    "dock",
    "fog",
]


MARKER_CROPS = {
    "city": (0, 20, 300, 270),
    "fort": (300, 55, 560, 255),
    "gate": (570, 40, 840, 270),
    "dock": (850, 35, 1115, 270),
    "camp": (1140, 40, 1510, 280),
    "watchtower": (0, 335, 175, 650),
    "farm": (210, 350, 480, 625),
    "lumber": (500, 350, 735, 625),
    "quarry": (755, 355, 970, 625),
    "mine": (980, 350, 1230, 625),
    "cart": (1250, 350, 1510, 650),
    "banner": (0, 700, 150, 1020),
    "arrow": (235, 725, 510, 875),
    "select": (530, 675, 765, 900),
    "border": (795, 700, 960, 970),
    "nameplate": (965, 705, 1270, 950),
    "warning": (1300, 690, 1530, 950),
}


def remove_light_background(image: Image.Image, threshold: int = 236) -> Image.Image:
    image = image.convert("RGBA")
    pixels = image.load()
    width, height = image.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if r >= threshold and g >= threshold and b >= threshold:
                pixels[x, y] = (r, g, b, 0)
    return image


def trim_alpha(image: Image.Image, padding: int = 8) -> Image.Image:
    bbox = image.getbbox()
    if not bbox:
        return image
    left, top, right, bottom = bbox
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(image.width, right + padding)
    bottom = min(image.height, bottom + padding)
    return image.crop((left, top, right, bottom))


def resize_contain(image: Image.Image, max_size: tuple[int, int]) -> Image.Image:
    image = image.copy()
    image.thumbnail(max_size, Image.Resampling.LANCZOS)
    return image


def slice_terrain() -> None:
    src = Image.open(GENERATED / "hex-terrain-atlas-clean-guofeng-v1.png")
    out_dir = PUBLIC_HEX / "terrain"
    out_dir.mkdir(parents=True, exist_ok=True)
    cell_w = src.width // 4
    cell_h = src.height // 3

    for index, name in enumerate(TERRAIN_NAMES):
        col = index % 4
        row = index // 4
        crop = src.crop((col * cell_w, row * cell_h, (col + 1) * cell_w, (row + 1) * cell_h))
        crop = remove_light_background(crop, 236)
        crop = trim_alpha(crop, 6)
        crop = resize_contain(crop, (136, 116))
        crop.save(out_dir / f"{name}.png")


def slice_markers() -> None:
    src = Image.open(GENERATED / "map-marker-atlas-clean-guofeng-v1.png")
    out_dir = PUBLIC_HEX / "markers"
    out_dir.mkdir(parents=True, exist_ok=True)

    for name, box in MARKER_CROPS.items():
        crop = src.crop(box)
        crop = remove_light_background(crop, 236)
        crop = trim_alpha(crop, 8)
        crop = resize_contain(crop, marker_size(name))
        crop.save(out_dir / f"{name}.png")


def marker_size(name: str) -> tuple[int, int]:
    if name in {"city", "gate", "dock", "camp"}:
        return (86, 72)
    if name in {"farm", "lumber", "quarry", "mine"}:
        return (64, 54)
    if name in {"banner"}:
        return (46, 74)
    if name in {"arrow", "select", "border", "nameplate", "warning"}:
        return (84, 72)
    return (68, 68)


def main() -> None:
    slice_terrain()
    slice_markers()


if __name__ == "__main__":
    main()
