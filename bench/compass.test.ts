// Compass maths: heading from device orientation angles.
import { cardinal, formatHeading, headingFromOrientation } from "../src/gps/compass.js";

declare const process: { exit(code: number): never };
let failures = 0;
function check(name: string, cond: boolean, detail?: any) {
  console.log(`${cond ? "✓" : "✗"} ${name}${!cond && detail !== undefined ? " — " + JSON.stringify(detail) : ""}`);
  if (!cond) failures++;
}
const near = (a: number, b: number, tol = 1) => Math.abs(((a - b + 540) % 360) - 180) <= tol;

check("flat, alpha 0 → north", near(headingFromOrientation(0, 0, 0), 0));
check("flat, alpha 90 → west (270°)", near(headingFromOrientation(90, 0, 0), 270));
check("flat, alpha 270 → east (90°)", near(headingFromOrientation(270, 0, 0), 90));
check("upright portrait, alpha 0 → north", near(headingFromOrientation(0, 90, 0), 0));
check("upright portrait, alpha 45 → 315°", near(headingFromOrientation(45, 90, 0), 315));
check("tilted 60°, alpha 120 → 240°", near(headingFromOrientation(120, 60, 0), 240));
check("flat and tilted agree near the switch", near(headingFromOrientation(30, 24, 0), headingFromOrientation(30, 26, 0), 2));
check("cardinal 247 → WSW", cardinal(247) === "WSW");
check("cardinal 359 → N", cardinal(359) === "N");
check("format", formatHeading(247.4) === "247° WSW");
console.log(failures ? `\n${failures} failed` : "\nAll compass tests passed.");
process.exit(failures ? 1 : 0);
