import { defineConfig } from "tsup";
import pkgJson from "./package.json";

let { name: packageName, version: packageVersion } = pkgJson;
let entry = ["src/cli.ts"];
let target = "es2022";
let banner = createBanner({
	author: "Chance Strickland",
	creationYear: 2024,
	license: "MIT",
	packageName,
	version: packageVersion,
});

export default defineConfig([
	{
		entry,
		format: ["esm"],
		banner: { js: banner },
		target,
		dts: { banner },
		clean: true,
		outDir: "dist",
	},
]);

function createBanner({
	packageName,
	version,
	author,
	license,
	creationYear,
}: {
	packageName: string;
	version: string;
	author: string;
	license: string;
	creationYear: string | number;
}) {
	let currentYear = new Date().getFullYear();
	let year =
		currentYear === Number(creationYear)
			? currentYear
			: `${creationYear}-${currentYear}`;

	return `/**
 * ${packageName} v${version}
 *
 * Copyright (c) ${year}, ${author}
 *
 * This source code is licensed under the ${license} license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @license ${license}
 */
`;
}
