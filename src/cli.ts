#!/usr/bin/env node

// This is forked and adapted from create-astro, because the Astro CLI brings me
// great joy and I want to use it even when I'm not using Astro.
//  Hiya Houston! 🚀
// https://github.com/withastro/astro/tree/main/packages/create-astro
// Copyright (c) 2021 Fred K. Schott MIT License

import process from "node:process";
import { createChanceApp } from "./main";

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

validateNodeVersion();

let argv = process.argv.slice(2).filter((arg) => arg !== "--");

createChanceApp(argv).then(
	() => process.exit(0),
	() => process.exit(1),
);

function validateNodeVersion() {
	let currentVersion = process.versions.node;
	let requiredMajorVersion = Number.parseInt(currentVersion.split(".")[0], 10);
	let minimumMajorVersion = 20;
	if (requiredMajorVersion < minimumMajorVersion) {
		console.error(`Node.js v${currentVersion} is out of date and unsupported!`);
		console.error(`Please use Node.js v${minimumMajorVersion} or higher.`);
		process.exit(1);
	}
}
