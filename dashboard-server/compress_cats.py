#!/usr/bin/env python3
"""
compress_cats.py
Compress all GIF files in C:\dashboard-server\cats\ to run smoother on 1GB RAM.

HOW TO USE:
1. Copy this script to C:\dashboard-server\
2. Make sure Python is installed (it is, since Node.js setup)
   Actually Python may not be installed — just double-click compress_cats.bat instead
3. Or run:  python compress_cats.py

What it does:
- Reduces GIF colors from 256 → 64 (biggest RAM saving)
- Resizes large GIFs down to max 400x300 pixels
- Sets frame delay to 80ms (smooth but not too fast)
- Reduces frames if there are too many (keeps every 2nd frame)
- Saves as optimized GIF in the same cats/ folder (overwrites original)
"""

import os
import sys
from PIL import Image, ImageSequence

CATS_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cats")
MAX_WIDTH  = 400
MAX_HEIGHT = 300
MAX_COLORS = 64   # reduce from 256 — huge memory saving
FRAME_DELAY = 150  # milliseconds between frames (80ms = smooth ~12fps)
SKIP_FRAMES = 2   # keep every Nth frame (2 = half the frames, smoother on weak hardware)

def compress_gif(path):
    filename = os.path.basename(path)
    orig_size = os.path.getsize(path)
    print("Processing: " + filename + " (" + str(round(orig_size/1024)) + " KB)")

    try:
        img = Image.open(path)
    except Exception as e:
        print("  SKIP — not a valid image: " + str(e))
        return

    if not hasattr(img, 'is_animated') and img.format != 'GIF':
        print("  SKIP — not a GIF")
        return

    frames = []
    frame_count = 0
    try:
        for frame in ImageSequence.Iterator(img):
            frame_count += 1
            if frame_count % SKIP_FRAMES != 0 and frame_count != 1:
                continue  # skip every other frame
            
            f = frame.copy().convert("RGBA")
            
            # resize if too big
            w, h = f.size
            if w > MAX_WIDTH or h > MAX_HEIGHT:
                ratio = min(MAX_WIDTH/float(w), MAX_HEIGHT/float(h))
                new_w = int(w * ratio)
                new_h = int(h * ratio)
                f = f.resize((new_w, new_h), Image.LANCZOS)
            
            # reduce colors
            f = f.convert("P", palette=Image.ADAPTIVE, colors=MAX_COLORS)
            frames.append(f)
    except EOFError:
        pass

    if len(frames) < 2:
        print("  SKIP — less than 2 frames after processing")
        return

    print("  Frames: " + str(frame_count) + " → " + str(len(frames)) + 
          " | Size: " + str(frames[0].size[0]) + "x" + str(frames[0].size[1]))

    # save optimized
    try:
        frames[0].save(
            path,
            format="GIF",
            save_all=True,
            append_images=frames[1:],
            optimize=True,
            duration=FRAME_DELAY,
            loop=0
        )
        new_size = os.path.getsize(path)
        saving = round((1 - new_size/orig_size) * 100)
        print("  Done! " + str(round(new_size/1024)) + " KB (saved " + str(saving) + "%)")
    except Exception as e:
        print("  ERROR saving: " + str(e))

def main():
    if not os.path.exists(CATS_FOLDER):
        print("ERROR: cats/ folder not found at: " + CATS_FOLDER)
        print("Make sure this script is in C:\\dashboard-server\\")
        input("Press Enter to exit...")
        return

    gif_files = [f for f in os.listdir(CATS_FOLDER) if f.lower().endswith(".gif")]
    
    if not gif_files:
        print("No GIF files found in: " + CATS_FOLDER)
        input("Press Enter to exit...")
        return

    print("=" * 50)
    print("CAT GIF COMPRESSOR")
    print("Found " + str(len(gif_files)) + " GIF files to compress")
    print("=" * 50)

    for gif_file in sorted(gif_files):
        full_path = os.path.join(CATS_FOLDER, gif_file)
        compress_gif(full_path)
        print("")

    print("=" * 50)
    print("ALL DONE! Restart your server and refresh tablet.")
    print("GIFs should now run much smoother on 1GB RAM.")
    print("=" * 50)
    input("Press Enter to exit...")

if __name__ == "__main__":
    main()
