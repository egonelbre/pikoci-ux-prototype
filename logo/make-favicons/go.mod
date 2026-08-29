module make-favicons

go 1.24

require github.com/loov/imago v0.0.0

// local imago checkout (pixelate.Options.Palette is not published yet)
replace github.com/loov/imago => ../../../../../loov/imago
