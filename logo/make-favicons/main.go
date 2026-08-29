// make-favicons regenerates logo/px/favicon-*.png from logo/px/src-256.png
// using imago's scale/pixelate with the logo's own 5-color palette — the
// output is genuine pixel art: no gray halos, no off-palette colors.
//
//	cd logo/make-favicons && go run . ../px/src-256.png ../px
//
// src-256.png is the SVG rendered at 256x256 and composited over WHITE —
// pixelate reads straight sRGB and ignores alpha, so a transparent
// background would quantize to black. To rebuild it after editing the SVG:
// render pikoci-logo.svg at 256px in any rasterizer and flatten to white.
//
// Palette notes: quantizing to the full PICO-8 palette occasionally snaps
// the yellow/blue antialiasing boundary to GREEN (its true Lab nearest);
// restricting to the five colors the logo actually uses avoids that.
package main

import (
	"fmt"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"

	"github.com/loov/imago/pix"
	"github.com/loov/imago/scale/pixelate"
)

var logoPalette = color.Palette{
	color.NRGBA{0x1D, 0x2B, 0x53, 0xFF}, // PICO-8 navy (keyline)
	color.NRGBA{0x29, 0xAD, 0xFF, 0xFF}, // PICO-8 blue (face)
	color.NRGBA{0xFF, 0xEC, 0x27, 0xFF}, // PICO-8 yellow (band, dot)
	color.NRGBA{0xFF, 0xFF, 0xFF, 0xFF}, // white (arrow, background)
	color.NRGBA{0xFF, 0xF1, 0xE8, 0xFF}, // PICO-8 cream
}

func main() {
	if len(os.Args) != 3 {
		fmt.Fprintln(os.Stderr, "usage: make-favicons <src-256.png> <outdir>")
		os.Exit(2)
	}
	f, err := os.Open(os.Args[1])
	if err != nil { panic(err) }
	img, _, err := image.Decode(f)
	f.Close()
	if err != nil { panic(err) }
	src := pix.FromImage(img)

	for _, size := range []int{16, 20, 24, 32, 48, 64} {
		m, err := pixelate.Resize(src, size, size, pixelate.Options{Palette: logoPalette})
		if err != nil { panic(err) }
		name := filepath.Join(os.Args[2], fmt.Sprintf("favicon-%d.png", size))
		out, err := os.Create(name)
		if err != nil { panic(err) }
		if err := png.Encode(out, m); err != nil { panic(err) }
		out.Close()
		fmt.Println("wrote", name)
	}
}
