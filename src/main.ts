// This is largely "forked" and adapted from create-astro, because the Astro
// CLI brings me great joy and I want to use it even when I'm not using Astro.
// Hiya Houston! 🚀
// https://github.com/withastro/astro/tree/main/packages/create-astro
// Copyright (c) 2021 Fred K. Schott MIT License

import process from "node:process";
import { prompt } from "@astrojs/cli-kit";
import { tasks } from "@astrojs/cli-kit";
import { random } from "@astrojs/cli-kit/utils";
import arg from "arg";
import os from "node:os";
import {
	help,
	verify,
	intro,
	projectName,
	template,
	dependencies,
	git,
	next,
} from "./actions";
import { type Context, detectPackageManager, getVersion } from "./misc";

export async function createChanceApp(cleanArgv: string[]) {
	console.log("");
	const ctx = await getContext(cleanArgv);
	if (ctx.help) {
		help();
		return;
	}

	const steps = [
		verify,
		intro,
		projectName,
		template,
		dependencies,

		// Steps which write to files need to go above git
		git,
	];

	for (const step of steps) {
		await step(ctx);
	}

	// biome-ignore lint/suspicious/noConsoleLog: allowed
	console.log("");

	const labels = {
		start: "Project initializing...",
		end: "Project initialized!",
	};
	await tasks(labels, ctx.tasks);

	await next(ctx);
}

/* -------------------------------------------------------------------------- */

async function getContext(argv: string[]): Promise<Context> {
	const flags = arg(
		{
			"--template": String,
			"--ref": String,
			"--yes": Boolean,
			"--no": Boolean,
			"--install": Boolean,
			"--no-install": Boolean,
			"--git": Boolean,
			"--no-git": Boolean,
			"--skip-animation": Boolean,
			"--dry-run": Boolean,
			"--help": Boolean,
			"--fancy": Boolean,

			"-y": "--yes",
			"-n": "--no",
			"-h": "--help",
			"-s": "--skip-animation",
		},
		{ argv, permissive: true },
	);

	const packageManager = detectPackageManager() ?? "npm";
	let cwd = flags["_"][0];
	let {
		"--help": help = false,
		"--template": template,
		"--no": no,
		"--yes": yes,
		"--install": install,
		"--no-install": noInstall,
		"--git": git,
		"--no-git": noGit,
		"--fancy": fancy,
		"--skip-animation": skipAnimation,
		"--dry-run": dryRun,
		"--ref": ref,
	} = flags;
	let projectName = cwd;

	if (no) {
		yes = false;
		if (install == undefined) install = false;
		if (git == undefined) git = false;
	}

	skipAnimation =
		((os.platform() === "win32" && !fancy) || skipAnimation) ??
		[yes, no, install, git].some((v) => v !== undefined);

	const { messages, hats, ties } = getSeasonalHouston({ fancy });

	const context: Context = {
		help,
		prompt,
		packageManager,
		version: getVersion(
			packageManager,
			"create-chance-app",
			process.env.ASTRO_VERSION,
		),
		skipAnimation,
		fancy,
		dryRun,
		projectName,
		template,
		ref: ref ?? "latest",
		welcome: random(messages),
		hat: hats ? random(hats) : undefined,
		tie: ties ? random(ties) : undefined,
		yes,
		install: install ?? (noInstall ? false : undefined),
		git: git ?? (noGit ? false : undefined),
		cwd,
		exit(code) {
			process.exit(code);
		},
		tasks: [],
	};
	return context;
}

interface SeasonalHouston {
	hats?: string[];
	ties?: string[];
	messages: string[];
}

function getSeasonalHouston({ fancy }: { fancy?: boolean }): SeasonalHouston {
	const season = getSeason();
	switch (season) {
		case "new-year": {
			const year = new Date().getFullYear();
			return {
				hats: rarity(0.5, ["🎩"]),
				ties: rarity(0.25, ["🎊", "🎀", "🎉"]),
				messages: [
					`New year, new project!`,
					`Kicking ${year} off with Chance?! What an honor!`,
					`Happy ${year}! Let's make something cool.`,
					`${year} is your year! Let's build something awesome.`,
					`${year} is clearly off to a great start!`,
					`Thanks for starting ${year} with Chance!`,
				],
			};
		}
		case "spooky":
			return {
				hats: rarity(0.5, ["🎃", "👻", "☠️", "💀", "🕷️", "🔮"]),
				ties: rarity(0.25, ["🦴", "🍬", "🍫"]),
				messages: [
					`I'm afraid I can't help you... Just kidding!`,
					`Boo! Just kidding. Let's make a website!`,
					`Let's haunt the internet. OooOooOOoo!`,
					`No tricks here. Seeing you is always treat!`,
					`Spiders aren't the only ones building the web!`,
					`Let's conjure up some web magic!`,
					`We're conjuring up a spooktacular website!`,
					`Prepare for a web of spooky wonders to be woven.`,
					`Chills and thrills await you on your new project!`,
				],
			};
		case "holiday":
			return {
				hats: rarity(0.75, ["🎁", "🎄", "🌲"]),
				ties: rarity(0.75, ["🧣"]),
				messages: [
					`'Tis the season to code and create.`,
					`Jingle all the way through your web creation journey!`,
					`Bells are ringing, and so are your creative ideas!`,
					`Let's make the internet our own winter wonderland!`,
					`It's time to decorate a brand new website!`,
					`Let's unwrap the magic of the web together!`,
					`Hope you're enjoying the holiday season!`,
					`I'm dreaming of a brand new website!`,
					`No better holiday gift than a new site!`,
					`Your creativity is the gift that keeps on giving!`,
				],
			};
		case undefined:
		default:
			return {
				hats: fancy
					? ["🎩", "🎩", "🎩", "🎩", "🎓", "👑", "🧢", "🍦"]
					: undefined,
				ties: fancy ? rarity(0.33, ["🎀", "🧣"]) : undefined,
				messages: [
					`Let's claim your corner of the internet.`,
					`I'll be your assistant today.`,
					`Let's build something awesome!`,
					`Let's build something great!`,
					`Let's build something fast!`,
					`Let's build the web we want.`,
					`Let's make the web weird!`,
					`Let's make the web a better place!`,
					`Let's create a new project!`,
					`Let's create something unique!`,
					`Time to build a new website.`,
					`Time to build a faster website.`,
					`Time to build a sweet new website.`,
					`We're glad to have you on board.`,
					`Keeping the internet weird since 2021.`,
					`Initiating launch sequence...`,
					`Initiating launch sequence... right... now!`,
					`Awaiting further instructions.`,
				],
			};
	}
}

type Season = "spooky" | "holiday" | "new-year";
function getSeason(): Season | undefined {
	const date = new Date();
	const month = date.getMonth() + 1;
	const day = date.getDate() + 1;

	if (month === 1 && day <= 7) {
		return "new-year";
	}
	if (month === 10 && day > 7) {
		return "spooky";
	}
	if (month === 12 && day > 7 && day < 25) {
		return "holiday";
	}
}

// Generates an array padded with empty strings to make decorations more rare
function rarity(frequency: number, emoji: string[]) {
	if (frequency === 1) return emoji;
	if (frequency === 0) return [""];
	const empty = Array.from(
		{ length: Math.round(emoji.length * frequency) },
		() => "",
	);
	return [...emoji, ...empty];
}
