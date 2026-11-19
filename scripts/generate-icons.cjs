// Code-generated app mark. No external images, fonts or image services.
const fs = require('node:fs');
const { PNG } = require('pngjs');
function icon(size, transparent = false) {
  const png = new PNG({ width: size, height: size });
  const scale = size / 1024;
  const rect = (left, top, right, bottom, color) => {
    for (let y = Math.round(top * scale); y < Math.round(bottom * scale); y++) {
      for (let x = Math.round(left * scale); x < Math.round(right * scale); x++) {
        const i = (size * y + x) * 4;
        for (let c = 0; c < 4; c++) png.data[i + c] = color[c];
      }
    }
  };
  rect(0, 0, 1024, 1024, transparent ? [0, 0, 0, 0] : [74, 109, 167, 255]);
  const ivory = [255, 255, 255, 255];
  for (const x of [290, 544]) for (const y of [290, 544]) rect(x, y, x + 190, y + 190, ivory);
  rect(596, 596, 682, 682, [168, 196, 234, 255]);
  return PNG.sync.write(png);
}
fs.writeFileSync('assets/icon.png', icon(1024));
fs.writeFileSync('assets/android-icon-foreground.png', icon(1024, true));
fs.writeFileSync('assets/favicon.png', icon(64));
