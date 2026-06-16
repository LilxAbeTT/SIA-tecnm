from pathlib import Path
import math

import qrcode
from qrcode.constants import ERROR_CORRECT_H
from PIL import Image, ImageDraw, ImageFont, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
LOGO_PATH = ROOT / "public" / "images" / "logo-sia.png"
OUT_PATH = ROOT / "image" / "cartel-sia-qr-carta-horizontal.png"
URL = "https://siaites.site"

# US Letter landscape at 300 DPI.
W, H = 3300, 2550


def font(size: int, weight: str = "regular") -> ImageFont.FreeTypeFont:
    candidates = {
        "black": [
            r"C:\Windows\Fonts\Montserrat-Black.ttf",
            r"C:\Windows\Fonts\Arialbd.ttf",
        ],
        "bold": [
            r"C:\Windows\Fonts\Montserrat-Bold.ttf",
            r"C:\Windows\Fonts\Arialbd.ttf",
        ],
        "regular": [
            r"C:\Windows\Fonts\Montserrat-Regular.ttf",
            r"C:\Windows\Fonts\Arial.ttf",
        ],
    }
    for candidate in candidates.get(weight, candidates["regular"]):
        path = Path(candidate)
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default(size=size)


def text_size(draw: ImageDraw.ImageDraw, text: str, face: ImageFont.FreeTypeFont) -> tuple[int, int]:
    left, top, right, bottom = draw.textbbox((0, 0), text, font=face)
    return right - left, bottom - top


def rounded_rect_with_shadow(
    base: Image.Image,
    box: tuple[int, int, int, int],
    radius: int,
    fill: tuple[int, int, int, int],
    shadow_offset: tuple[int, int] = (0, 18),
    shadow_radius: int = 34,
    shadow_fill: tuple[int, int, int, int] = (15, 34, 48, 48),
) -> None:
    shadow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    x0, y0, x1, y1 = box
    ox, oy = shadow_offset
    sd.rounded_rectangle((x0 + ox, y0 + oy, x1 + ox, y1 + oy), radius, fill=shadow_fill)
    shadow = shadow.filter(ImageFilter.GaussianBlur(shadow_radius))
    base.alpha_composite(shadow)
    ImageDraw.Draw(base).rounded_rectangle(box, radius, fill=fill)


def fit_image(img: Image.Image, max_w: int, max_h: int) -> Image.Image:
    scale = min(max_w / img.width, max_h / img.height)
    size = (int(img.width * scale), int(img.height * scale))
    return img.resize(size, Image.Resampling.LANCZOS)


def make_qr(url: str, px: int) -> Image.Image:
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_H,
        box_size=18,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#10212d", back_color="white").convert("RGBA")
    return img.resize((px, px), Image.Resampling.NEAREST)


def draw_wrapped(
    draw: ImageDraw.ImageDraw,
    text: str,
    xy: tuple[int, int],
    max_width: int,
    face: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int],
    line_gap: int,
) -> int:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        probe = word if not current else f"{current} {word}"
        if text_size(draw, probe, face)[0] <= max_width:
            current = probe
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)

    x, y = xy
    for line in lines:
        draw.text((x, y), line, font=face, fill=fill)
        y += text_size(draw, line, face)[1] + line_gap
    return y


def main() -> None:
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    bg = Image.new("RGBA", (W, H), "#f6f9fb")
    draw = ImageDraw.Draw(bg)

    # Structured print background.
    draw.rectangle((0, 0, W, H), fill="#f7fbfd")
    draw.polygon([(0, 0), (1150, 0), (760, H), (0, H)], fill="#ecf6f4")
    draw.polygon([(2460, 0), (W, 0), (W, H), (2920, H)], fill="#fceee7")
    draw.rectangle((0, H - 92, W, H), fill="#10212d")
    draw.rectangle((0, H - 92, 1060, H), fill="#2e9c8f")
    draw.rectangle((1060, H - 92, 1395, H), fill="#e76f51")

    # Accent arcs.
    for i, color in enumerate(["#2e9c8f", "#e76f51", "#f4c95d"]):
        bbox = (190 + i * 86, 185 + i * 72, 790 + i * 86, 785 + i * 72)
        draw.arc(bbox, start=198, end=320, fill=color, width=18)

    logo = Image.open(LOGO_PATH).convert("RGBA")
    logo_fit = fit_image(logo, 450, 470)
    bg.alpha_composite(logo_fit, (245, 230))

    title_face = font(222, "black")
    title2_face = font(128, "black")
    body_face = font(58, "regular")
    body_bold = font(66, "bold")
    small_face = font(40, "regular")
    url_face = font(62, "bold")

    draw.text((250, 805), "Escanea", font=title_face, fill="#10212d")
    draw.text((250, 1015), "e ingresa", font=title_face, fill="#10212d")
    draw.text((250, 1225), "a SIA", font=title2_face, fill="#2e9c8f")

    y = draw_wrapped(
        draw,
        "Accede rápido al Sistema Integral Académico (SIA) desde tu celular.",
        (258, 1420),
        1160,
        body_face,
        (31, 48, 61),
        20,
    )

    # Callout pill.
    pill = (252, y + 78, 1285, y + 214)
    draw.rounded_rectangle(pill, 68, fill="#10212d")
    draw.ellipse((286, y + 114, 322, y + 150), fill="#2e9c8f")
    draw.text((355, y + 103), "Apunta tu cámara al código", font=body_bold, fill="white")

    qr_size = 1180
    qr_x, qr_y = 1765, 440
    card = (1580, 255, 3130, 2015)
    rounded_rect_with_shadow(bg, card, 54, (255, 255, 255, 255))

    # QR frame.
    frame = (qr_x - 62, qr_y - 62, qr_x + qr_size + 62, qr_y + qr_size + 62)
    draw.rounded_rectangle(frame, 42, fill="#ffffff", outline="#d7e4e8", width=7)
    qr_img = make_qr(URL, qr_size)
    bg.alpha_composite(qr_img, (qr_x, qr_y))

    # Corner scan marks.
    mark_color = "#2e9c8f"
    mark_w = 24
    length = 150
    corners = [
        (frame[0] + 38, frame[1] + 38, 1, 1),
        (frame[2] - 38, frame[1] + 38, -1, 1),
        (frame[0] + 38, frame[3] - 38, 1, -1),
        (frame[2] - 38, frame[3] - 38, -1, -1),
    ]
    for x, yy, sx, sy in corners:
        draw.line((x, yy, x + sx * length, yy), fill=mark_color, width=mark_w)
        draw.line((x, yy, x, yy + sy * length), fill=mark_color, width=mark_w)

    label = "siaites.site"
    label_w, _ = text_size(draw, label, url_face)
    draw.text((qr_x + qr_size // 2 - label_w // 2, 1746), label, font=url_face, fill="#10212d")

    subtitle = "Escanea el código QR para entrar"
    sub_w, _ = text_size(draw, subtitle, small_face)
    draw.text((qr_x + qr_size // 2 - sub_w // 2, 1840), subtitle, font=small_face, fill="#54707b")

    # Footer.
    footer_text = "SIA - Sistema Integral Académico"
    footer_w, footer_h = text_size(draw, footer_text, small_face)
    draw.text((W - footer_w - 178, H - 62 - footer_h // 2), footer_text, font=small_face, fill="white")

    # Export with print DPI metadata.
    rgb = bg.convert("RGB")
    rgb.save(OUT_PATH, "PNG", dpi=(300, 300), optimize=True)
    print(OUT_PATH)
    print(f"{W}x{H}px @ 300 DPI")
    print(URL)


if __name__ == "__main__":
    main()
