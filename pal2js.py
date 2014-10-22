# This script reads WCSO .pal files, and generates a palettes.js file from them
import struct
import chunk
import glob
import os.path

# This is the stuff that will go at the top of palettes.js
JS_TEMPLATE = """var extPalettes = {};

function Colour(red, green, blue) {
    this.red = red;
    this.green = green;
    this.blue = blue;
}"""
COLOUR_TEMPLATE = """new Colour ({red}, {green}, {blue})"""
# This will be formatted into a palette definition
PAL_TEMPLATE = """extPalettes["{palname}"] = [{colours}];"""
OUTPUT_FILENAME = "palettes.js"

try:
    paljs = open(OUTPUT_FILENAME, "x")
except IOError:
    print(OUTPUT_FILENAME, "already exists!")

paljs = open(OUTPUT_FILENAME, "w")

# Put the JS Template at the top of palettes.js
print(JS_TEMPLATE, file=paljs)

# Get a list of palettes in the pal directory
palettes = []
for palname in glob.iglob("pal/*.pal"):
    palettes.append(os.path.splitext(os.path.basename(palname))[0])

for palname in palettes:
    # Open the palette file
    palfile = open("pal/" + palname + ".pal", "rb")
    # Do some stuff to ensure the palette is in the right format
    if palfile.read(4) == b"FORM":
        # Now we know it's an IFF file
        palfile.seek(12, 0)
        if palfile.read(4) == b"CMAP":
            # Now we know it's a VISION engine palette file
            palsize = struct.unpack(">I", palfile.read(4))[0]
            # Ensure the palette can be read into RGB triples
            if (palsize % 3 == 0):
                # Read each colour
                colours = []
                for colour in range(palsize // 3):
                    red = struct.unpack("<B", palfile.read(1))[0]
                    green = struct.unpack("<B", palfile.read(1))[0]
                    blue = struct.unpack("<B", palfile.read(1))[0]
                    colours.append(COLOUR_TEMPLATE.format(
                        red = red,
                        green = green,
                        blue = blue
                    ))
                # Create a palette definition
                print(PAL_TEMPLATE.format(
                    palname = palname.lower(),
                    colours = ",\n".join(colours)
                ), file = paljs)