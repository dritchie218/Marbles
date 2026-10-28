# Builds Marbles-Home-Screen-Directions.pdf (how to add the game to a phone home screen).
# Needs: pip install reportlab. Run from the repo after the icons exist (npm run icons):
#   python tools/make-guide.py
import os
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF
from reportlab.lib.utils import ImageReader

URL = 'https://dritchie218.github.io/Marbles/'
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'Marbles-Home-Screen-Directions.pdf')
PUR, PUR2, GOLD, INK, GREY = HexColor('#5a2d9c'), HexColor('#26104a'), HexColor('#ffc62f'), HexColor('#2b2118'), HexColor('#5c5566')

W, H = letter
c = canvas.Canvas(OUT, pagesize=letter)
c.setTitle('Marbles - Add to Home Screen')
c.setAuthor('Marbles')

# header band
c.setFillColor(PUR2); c.rect(0, H - 130, W, 130, stroke=0, fill=1)
c.setFillColor(GOLD); c.rect(0, H - 134, W, 4, stroke=0, fill=1)
icon = ImageReader(os.path.join(ROOT, 'icons', 'icon-512.png'))
c.drawImage(icon, 40, H - 115, 96, 96)
c.setFillColor(white); c.setFont('Helvetica-Bold', 30); c.drawString(156, H - 62, 'Marbles')
c.setFillColor(GOLD); c.setFont('Helvetica', 15); c.drawString(156, H - 86, 'Add the game to your phone\u2019s home screen')
c.setFillColor(white); c.setFont('Helvetica', 11); c.drawString(156, H - 106, URL)

# QR code
qw = qr.QrCodeWidget(URL); b = qw.getBounds(); s = 92
d = Drawing(s, s, transform=[s / (b[2] - b[0]), 0, 0, s / (b[3] - b[1]), 0, 0]); d.add(qw)
c.setFillColor(white); c.roundRect(W - 40 - s - 8, H - 122, s + 8, s + 8, 6, stroke=0, fill=1)
renderPDF.draw(d, c, W - 40 - s - 4, H - 118)
c.setFillColor(GREY); c.setFont('Helvetica', 9)
c.drawCentredString(W - 40 - s / 2 - 4, H - 146, 'Scan with your camera')

def share_icon(x, y, sz=11):
    c.setStrokeColor(PUR); c.setLineWidth(1.2)
    c.rect(x, y, sz, sz * .75, stroke=1, fill=0)
    c.line(x + sz / 2, y + sz * .35, x + sz / 2, y + sz * 1.15)
    c.line(x + sz / 2, y + sz * 1.15, x + sz * .25, y + sz * .88)
    c.line(x + sz / 2, y + sz * 1.15, x + sz * .75, y + sz * .88)

def dots_icon(x, y):
    c.setFillColor(PUR)
    for i in range(3): c.circle(x + 2, y + 1.5 + i * 4.2, 1.4, stroke=0, fill=1)

def section(y, title, steps):
    c.setFillColor(PUR); c.roundRect(40, y - 4, W - 80, 30, 6, stroke=0, fill=1)
    c.setFillColor(white); c.setFont('Helvetica-Bold', 16); c.drawString(54, y + 5, title)
    y -= 36
    for n, (parts, icon_fn) in enumerate(steps, 1):
        c.setFillColor(GOLD); c.circle(58, y + 4, 11, stroke=0, fill=1)
        c.setFillColor(PUR2); c.setFont('Helvetica-Bold', 12); c.drawCentredString(58, y, str(n))
        x = 80
        for txt, bold in parts:
            if txt == '<ICON>':
                icon_fn(x + 2, y - 1); x += 16; continue
            f = 'Helvetica-Bold' if bold else 'Helvetica'
            c.setFont(f, 12.5); c.setFillColor(INK); c.drawString(x, y, txt); x += c.stringWidth(txt, f, 12.5)
        y -= 30
    return y

y = H - 190
y = section(y, 'iPhone  (use Safari)', [
    ([('Open the link above in ', 0), ('Safari', 1), ('.', 0)], None),
    ([('Tap the ', 0), ('Share', 1), (' button ', 0), ('<ICON>', 0), (' at the bottom of the screen.', 0)], share_icon),
    ([('Scroll down and tap ', 0), ('Add to Home Screen', 1), ('.', 0)], None),
    ([('Keep the name ', 0), ('Marbles', 1), (' and tap ', 0), ('Add', 1), ('.', 0)], None),
])
y -= 14
y = section(y, 'Android  (use Chrome)', [
    ([('Open the link above in ', 0), ('Chrome', 1), ('.', 0)], None),
    ([('If you see ', 0), ('Install', 1), (' or ', 0), ('Add Marbles to Home screen', 1), (', tap it.', 0)], None),
    ([('Otherwise tap the menu ', 0), ('<ICON>', 0), (' (top right) \u2192 ', 0), ('Add to Home screen', 1), (' or ', 0), ('Install app', 1), ('.', 0)], dots_icon),
    ([('Tap ', 0), ('Install', 1), (' or ', 0), ('Add', 1), (' to confirm.', 0)], None),
])

# good to know box
y -= 14
bh = 128
c.setFillColor(HexColor('#f6f1e7')); c.setStrokeColor(GOLD); c.setLineWidth(1.5)
c.roundRect(40, y - bh + 20, W - 80, bh, 8, stroke=1, fill=1)
c.setFillColor(PUR2); c.setFont('Helvetica-Bold', 14); c.drawString(56, y, 'Good to know')
tips = [
    ('Tap the purple & gold ', 'Marbles', ' icon to play \u2014 it opens full screen like an app.'),
    ('Works with no signal ', '', 'after it has been opened online at least once.'),
    ('Updates are ', 'automatic', ' the next time you open it with a connection.'),
    ('Don\u2019t want to install? ', '', 'Just use the link in your browser \u2014 same game.'),
    ('To remove it, press and hold the icon and choose ', 'Remove', ' or Delete App.'),
]
ty = y - 22
for a, b2, cc in tips:
    c.setFillColor(GOLD); c.circle(60, ty + 4, 3, stroke=0, fill=1)
    x = 70
    for txt, f in ((a, 'Helvetica'), (b2, 'Helvetica-Bold'), (cc, 'Helvetica')):
        c.setFillColor(INK); c.setFont(f, 11.5); c.drawString(x, ty, txt); x += c.stringWidth(txt, f, 11.5)
    ty -= 19

c.setFillColor(GREY); c.setFont('Helvetica-Oblique', 9)
c.drawCentredString(W / 2, 30, 'Menu names can vary slightly by phone model and software version.')
c.showPage(); c.save()
print('wrote Marbles-Home-Screen-Directions.pdf')
