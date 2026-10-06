# Silhouette Studio

A self-contained GitHub Pages generator that turns SVG, PNG, and JPEG artwork into a multicolor wall hanger. It runs entirely in the browser. Artwork stays on the device; no server, Python, OpenSCAD, or external SVG converter is needed by the person using the generator.

## Put it on GitHub Pages

1. Create a GitHub repository named `wall-hanger-generator` with default branch `main`. Upload the contents of this folder to the root of that repository. Include `.github/workflows/pages.yml`; GitHub's file picker may hide dot folders, so use Git or drag the full extracted folder contents if necessary.
2. Open **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. Open **Actions → Deploy GitHub Pages** and run the workflow if it has not already run. After it succeeds, open the URL shown in its deployment. The usual address is `https://YOUR-USERNAME.github.io/wall-hanger-generator/`.

The included workflow deploys static files directly. It uses relative paths, so a project repository URL works. No npm installation or build service is needed for deployment. To put the generator in a MakerWorld listing, link to the published GitHub Pages URL in the description; this is a standalone web app, not a SCAD script for MakerWorld's built-in customizer.

## Using the generator

Upload an SVG or image, or try the included original flower example. Adjust artwork size, thickness, edge smoothing, and maximum colors with the sliders. Edge smoothing defaults to 0 mm; try 0.3 mm for rounded outline and color boundaries. Larger values can erase narrow features and tiny regions. Arch dimensions stay fixed; placement accounts for the smoothed outline. Click the palette to change filament colors. Automatic arch placement checks the silhouette at both feet of each arch and prefers positions above the artwork's center of area, with the pair centered near it. Manual placement is available under the collapsed adjustment panel and rejects unsupported feet.

Front shows the artwork as it will appear when hung. Back and 3D show the rear arches. Download **color 3MF** for separate color solids in one assembly, or **single-color STL** for a fused mesh.

## Geometry and printing

- Artwork size means the longest side of the cropped image, in millimeters. Aspect ratio is preserved. Thin features are approximated at 512 pixels along the longest dimension.
- The colorful face lies flat at Z=0. Color inlays are 0.6 mm deep. The backing finishes at the thickness selected by the user, which defaults to 3 mm.
- Two rear arches use 3 mm diameter round rods, semicircular tops, 4 mm clear openings, and approximately 12 × 5 mm mounting footprints. Their physical dimensions stay fixed when artwork size changes. Foot pads widen to 4.5 mm to join the body.
- Print with the colored face on the bed and arches above it. The exported geometry is already oriented this way; do not mirror it again.
- The standard 3MF contains material colors and separate solid parts, not printer profiles, sliced layers, or automatic AMS assignments. Import the assembly into your slicer and map its color parts to filaments. Some slicers require you to choose “load as one object with multiple parts.”
- STL has geometry only. Its color regions are fused before export to avoid internal coincident faces.
- Review the arches, overhangs, bed adhesion, and your filament before printing. The geometry is checked computationally; a physical test print has not been performed.

## Input limits

Up to 8 solid colors are supported. Simple SVGs with a small flat palette retain their source colors; gradients, photos, and larger palettes are reduced to the selected color count. SVGs are rendered and traced rather than imported as exact Bézier curves. Very fine details and tiny color islands may disappear. Transparent backgrounds work best. Optional background removal removes a corner-colored region connected to the image boundary, keeping enclosed light details.

A disconnected design is reported as a warning and needs review before hanging. Automatic placement is a geometric heuristic, not a load or strength simulation. Narrow designs may need a larger artwork size. External SVG images, fonts, and styles must be embedded; scripts and event handlers are removed. Images above 15 MB are rejected. Large or complex artwork can take several seconds to generate.

## Run locally

Do not double-click `index.html`: browser workers and WASM need HTTP.

```sh
python3 -m http.server 8765
```

Open `http://localhost:8765/`. The shipped `vendor/` folder already contains the runtime libraries.

For development with Node 22.12 or newer:

```sh
npm ci
npm run dev
npm test
npm run build
```

`npm run build` copies a standalone static site into `dist/`; it keeps workers, the WASM binary, and the local import map intact.

Optional browser verification, with the site running on port 8765:

```sh
npx playwright install chromium
npm run test:browser
# Or upload an additional SVG during the check:
npm run test:browser -- /path/to/artwork.svg
```

Set `TEST_URL` for another server URL. The browser check covers the example, preview switches, 3MF/STL downloads, optional upload, and mobile overflow. Geometry tests cover closed meshes, placement rejection, raster SVG colors, preserved holes, and export structure. Browser launch was blocked in the creation workspace, so interactive visual verification remains pending; the geometry/export tests ran successfully.

## Dependencies and license

Original application code and flower example are MIT licensed; see `LICENSE`. Vendored libraries have their own license files in `vendor/`: Three.js, Manifold, and JSZip. Development-only SVG rendering uses resvg. This is an original implementation inspired by the browser-generator workflow at https://vostoklabs.github.io/Clicker-Generator/; it does not copy that project's application code or artwork.
