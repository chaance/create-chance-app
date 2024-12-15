import { awesome } from "./index.ts";
import assert from "node:assert";

let txt = awesome();
assert.strictEqual(txt, "you did it 😎");

console.log("Tests passed! 😎");
