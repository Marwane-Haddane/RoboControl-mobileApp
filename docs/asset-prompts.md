# App assets

Generated with the built-in Image Gen tool, based on approved design 1 and the actual robot photograph in the parent project's Pictures/Product.png. All consuming assets are saved in `public/assets/hexapod/`.

- `robot.png`: Transparent black six-legged Freenove hexapod cutout, three-quarter view, complete real kit construction, cyan rim lighting, no text. Intended hero slot approximately 194 × 149 logical pixels, reused for body control preview.
- `background.png`: Full-bleed portrait navy background, subtle teal shading, faint outlined honeycomb concentrated at upper-right, mid-right and lower-left. Quiet center. No robot, UI, text, or icons. Intended 390 × 844 logical viewport.
- `thumb.png`: Transparent isolated cyan circular tactile joystick puck, shallow raised thickness, grippy dimples, gentle edge shading. No arrows, text, or surrounding bowl. Intended 70px visible diameter.
- `body-pad.png`: Transparent flat top-down diagram based on the user's original-app screenshot: six thick rounded cyan legs, two diagonally upward, two horizontal, two diagonally downward, around a muted slate square chassis. No text or interface. Used under the two-axis body touch control, about 290 × 326 logical pixels.

The selected full-screen visual target is preserved at `docs/design-1.png`. Generated bitmap assets are separate from real interactive controls, labels, and Phosphor icons.

Version 1.2 follows `docs/body-real-kit-design.png`, selected option 1 of the realistic Body concepts. New separate transparent assets were generated with the built-in tool from that reference and the actual kit photo: `rig-chassis.png` (1136×1385 overhead black acrylic chassis / PCB), `rig-upper.png` (2172×724 rigid linkage, pivots at 13.4%/86.6% width and 50.5% height), `rig-lower.png` (2172×724 tapered lower linkage, knee anchor 10.8%/51%, foot 94%/64%), and `rig-servo.png` (isolated servo housing with silver hub). Rendering uses these measured anchor positions to keep parts connected as they rotate. Assets are reused across six independently solved legs; no flattened full-robot screenshot is used for the animated control.

Version 1.3 tried broader separate photographic links. In version 1.4 the user asked for the original app's six continuous “elastic” legs to avoid joints appearing broken at extreme body moves. `rig-elastic-leg.svg` is a wide, rounded cyan capsule with a soft highlight and shadow, designed to stretch in length while keeping a constant thickness. It is displayed once per leg, from the chassis anchor to its fixed planted foot, behind the photographed chassis. This is code-drawn SVG rather than generated raster because the flat, scalable shape matches the provided control references and remains crisp at every phone size.
