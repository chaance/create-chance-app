import fs from "node:fs";
import path from "node:path";
import dns from "node:dns";
import {
	banner,
	bannerAbort,
	error,
	info,
	log,
	nextSteps,
	printHelp,
	say,
	shell,
	title,
	type Context,
} from "./misc";
import { downloadTemplate, verifyTemplate } from "@bluwy/giget-core";
import { color, generateProjectName, label } from "@astrojs/cli-kit";

const FILES_TO_REMOVE = ["CHANGELOG.md"];
const FILES_TO_UPDATE = {
	"package.json": (file: string, overrides: { name: string }) =>
		fs.promises.readFile(file, "utf-8").then((value) => {
			// Match first indent in the file or fallback to `\t`
			const indent = /(^\s+)/m.exec(value)?.[1] ?? "\t";
			return fs.promises.writeFile(
				file,
				JSON.stringify(
					Object.assign(
						JSON.parse(value),
						Object.assign(overrides, { private: undefined }),
					),
					null,
					indent,
				),
				"utf-8",
			);
		}),
};
// Some existing files and directories can be safely ignored when checking if a directory is a valid project directory.
// https://github.com/facebook/create-react-app/blob/d960b9e38c062584ff6cfb1a70e1512509a966e7/packages/create-react-app/createReactApp.js#L907-L934
const VALID_PROJECT_DIRECTORY_SAFE_LIST = [
	".DS_Store",
	".git",
	".gitkeep",
	".gitattributes",
	".gitignore",
	".gitlab-ci.yml",
	".hg",
	".hgcheck",
	".hgignore",
	".idea",
	".npmignore",
	".travis.yml",
	".yarn",
	".yarnrc.yml",
	"docs",
	"LICENSE",
	"mkdocs.yml",
	"Thumbs.db",
	/\.iml$/,
	/^npm-debug\.log/,
	/^yarn-debug\.log/,
	/^yarn-error\.log/,
];

/* -------------------------------------------------------------------------- */

export function help() {
	printHelp({
		commandName: "create-chance-app",
		usage: "[dir] [...flags]",
		headline: "Scaffold projects.",
		tables: {
			Flags: [
				["--help (-h)", "See all available flags."],
				["--template <name>", "Specify your template."],
				["--install / --no-install", "Install dependencies (or not)."],
				["--add <integrations>", "Add integrations."],
				["--git / --no-git", "Initialize git repo (or not)."],
				["--yes (-y)", "Skip all prompts by accepting defaults."],
				["--no (-n)", "Skip all prompts by declining defaults."],
				["--dry-run", "Walk through steps without executing."],
				["--skip-animations (-s)", "Skip animations."],
				["--ref", "Choose branch (default: latest)."],
				["--fancy", "Enable full Unicode support for Windows."],
			],
		},
	});
}

export async function verify(
	ctx: Pick<Context, "version" | "dryRun" | "template" | "ref" | "exit">,
) {
	if (!ctx.dryRun) {
		const online = await isOnline();
		if (!online) {
			bannerAbort();
			log("");
			error("error", `Unable to connect to the internet.`);
			ctx.exit(1);
		}
	}

	if (ctx.template) {
		const target = getTemplateTarget(ctx.template, ctx.ref);
		const ok = await verifyTemplate(target);
		if (!ok) {
			bannerAbort();
			log("");
			error(
				"error",
				`Template ${color.dim(ctx.template)} ${color.dim("could not be found!")}`,
			);
			await info(
				"check",
				"https://github.com/chaance/create-chance-app/templates",
			);
			ctx.exit(1);
		}
	}
}

export async function intro(
	ctx: Pick<
		Context,
		"welcome" | "hat" | "tie" | "version" | "fancy" | "skipAnimation"
	>,
) {
	banner();

	if (!ctx.skipAnimation) {
		const { welcome, hat, tie } = ctx;
		await say(
			[
				[
					"Welcome",
					"to",
					label("create-chance-app", color.bgGreen, color.black),
					Promise.resolve(ctx.version).then((version) =>
						version ? color.green(`v${version}`) : "",
					),
				],
				welcome ?? "Let's build something awesome!",
			] as string[],
			{ clear: true, hat, tie },
		);
	}
}

export async function projectName(
	ctx: Pick<
		Context,
		"cwd" | "yes" | "dryRun" | "prompt" | "projectName" | "exit"
	>,
) {
	const empty = ctx.cwd && isEmpty(ctx.cwd);
	if (empty) {
		log("");
		await info(
			"dir",
			`Using ${color.reset(ctx.cwd)}${color.dim(" as project directory")}`,
		);
	}

	if (!ctx.cwd || !isEmpty(ctx.cwd)) {
		if (!isEmpty(ctx.cwd)) {
			await info(
				"Hmm...",
				`${color.reset(`"${ctx.cwd}"`)}${color.dim(` is not empty!`)}`,
			);
		}

		if (ctx.yes) {
			ctx.projectName = generateProjectName();
			ctx.cwd = `./${ctx.projectName}`;
			await info("dir", `Project created at ./${ctx.projectName}`);
			return;
		}

		const { name } = await ctx.prompt({
			name: "name",
			type: "text",
			label: title("dir"),
			message: "Where should we create your new project?",
			initial: `./${generateProjectName()}`,
			validate(value: string) {
				if (!isEmpty(value)) {
					return `Directory is not empty!`;
				}
				// Check for non-printable characters
				if (value.match(/[^\x20-\x7E]/g) !== null)
					return `Invalid non-printable character present!`;
				return true;
			},
		});

		ctx.cwd = name!.trim();
		ctx.projectName = toValidProjectName(name!);
		if (ctx.dryRun) {
			await info("--dry-run", "Skipping project naming");
			return;
		}
	} else {
		let name = ctx.cwd;
		if (name === "." || name === "./") {
			const parts = process.cwd().split(path.sep);
			name = parts[parts.length - 1];
		} else if (name.startsWith("./") || name.startsWith("../")) {
			const parts = name.split("/");
			name = parts[parts.length - 1];
		}
		ctx.projectName = toValidProjectName(name);
	}

	if (!ctx.cwd) {
		ctx.exit(1);
	}
}

export async function template(
	ctx: Pick<
		Context,
		"template" | "prompt" | "yes" | "dryRun" | "exit" | "tasks"
	>,
) {
	if (!ctx.template && ctx.yes) {
		ctx.template = "tspkg";
	}

	if (ctx.template) {
		await info(
			"tmpl",
			`Using ${color.reset(ctx.template)}${color.dim(" as project template")}`,
		);
	} else {
		const { template: tmpl } = await ctx.prompt({
			name: "template",
			type: "select",
			label: title("tmpl"),
			message: "How would you like to start your new project?",
			initial: "tspkg",
			choices: [
				{ value: "tspkg", label: "Generic TypeScript package" },
				{ value: "react-router", label: "React Router app" },
			],
		});
		ctx.template = tmpl;
	}

	if (ctx.dryRun) {
		await info("--dry-run", `Skipping template copying`);
	} else if (ctx.template) {
		ctx.tasks.push({
			pending: "Template",
			start: "Template copying...",
			end: "Template copied",
			while: () =>
				copyTemplate(ctx.template!, ctx as Context).catch((e) => {
					if (e instanceof Error) {
						error("error", e.message);
						process.exit(1);
					} else {
						error("error", "Unable to clone template.");
						process.exit(1);
					}
				}),
		});
	} else {
		ctx.exit(1);
	}
}

export async function dependencies(
	ctx: Pick<
		Context,
		"install" | "yes" | "prompt" | "packageManager" | "cwd" | "dryRun" | "tasks"
	>,
) {
	let deps = ctx.install ?? ctx.yes;
	if (deps === undefined) {
		({ deps } = await ctx.prompt({
			name: "deps",
			type: "confirm",
			label: title("deps"),
			message: `Install dependencies?`,
			hint: "recommended",
			initial: true,
		}));
		ctx.install = deps;
	}

	if (ctx.dryRun) {
		await info("--dry-run", "Skipping dependency installation");
	} else if (deps) {
		ctx.tasks.push({
			pending: "Dependencies",
			start: `Dependencies installing with ${ctx.packageManager}...`,
			end: "Dependencies installed",
			onError: (e) => {
				error("error", e);
				error(
					"error",
					`Dependencies failed to install, please run ${color.bold(
						ctx.packageManager + " install",
					)} to install them manually after setup.`,
				);
			},
			while: () =>
				installDeps({ packageManager: ctx.packageManager, cwd: ctx.cwd }),
		});
	} else {
		await info(
			ctx.yes === false ? "deps [skip]" : "No problem!",
			"Remember to install dependencies after setup.",
		);
	}
}

export async function git(
	ctx: Pick<Context, "cwd" | "git" | "yes" | "prompt" | "dryRun" | "tasks">,
) {
	if (fs.existsSync(path.join(ctx.cwd, ".git"))) {
		await info("Nice!", `Git has already been initialized`);
		return;
	}
	let _git = ctx.git ?? ctx.yes;
	if (_git === undefined) {
		({ git: _git } = await ctx.prompt({
			name: "git",
			type: "confirm",
			label: title("git"),
			message: `Initialize a new git repository?`,
			hint: "optional",
			initial: true,
		}));
	}

	if (ctx.dryRun) {
		await info("--dry-run", `Skipping Git initialization`);
	} else if (_git) {
		ctx.tasks.push({
			pending: "Git",
			start: "Git initializing...",
			end: "Git initialized",
			while: () =>
				initGit({ cwd: ctx.cwd }).catch((e) => {
					error("error", e);
					process.exit(1);
				}),
		});
	} else {
		await info(
			ctx.yes === false ? "git [skip]" : "Sounds good!",
			`You can always run ${color.reset("git init")}${color.dim(" manually.")}`,
		);
	}
}

export async function next(
	ctx: Pick<
		Context,
		"hat" | "tie" | "cwd" | "packageManager" | "skipAnimation"
	>,
) {
	let projectDir = path.relative(process.cwd(), ctx.cwd);

	const commandMap: { [key: string]: string } = {
		npm: "npm run dev",
		bun: "bun run dev",
		yarn: "yarn dev",
		pnpm: "pnpm dev",
	};

	const devCmd =
		commandMap[ctx.packageManager as keyof typeof commandMap] || "npm run dev";
	await nextSteps({ projectDir, devCmd });

	if (!ctx.skipAnimation) {
		await say(["Good luck out there! 🚀"], {
			hat: ctx.hat,
			tie: ctx.tie,
		});
	}
	return;
}

/* -------------------------------------------------------------------------- */

function isEmpty(dirPath: string) {
	if (!fs.existsSync(dirPath)) {
		return true;
	}

	const conflicts = fs.readdirSync(dirPath).filter((content) => {
		return !VALID_PROJECT_DIRECTORY_SAFE_LIST.some((safeContent) => {
			return typeof safeContent === "string"
				? content === safeContent
				: safeContent.test(content);
		});
	});

	return conflicts.length === 0;
}

async function isOnline(): Promise<boolean> {
	try {
		await dns.promises.lookup("github.com");
		return true;
	} catch {
		return false;
	}
}

function isValidProjectName(projectName: string) {
	return /^(?:@[a-z\d\-*~][a-z\d\-*._~]*\/)?[a-z\d\-~][a-z\d\-._~]*$/.test(
		projectName,
	);
}

function toValidProjectName(projectName: string) {
	if (isValidProjectName(projectName)) {
		return projectName;
	}

	return projectName
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/^[._]/, "")
		.replace(/[^a-z\d\-~]+/g, "-")
		.replace(/^-+/, "")
		.replace(/-+$/, "");
}

function getTemplateTarget(tmpl: string, ref = "latest") {
	// Handle third-party templates
	const isThirdParty = tmpl.includes("/");
	if (isThirdParty) {
		return tmpl;
	}

	// Handle internal templates
	if (ref === "latest") {
		// `latest` ref is specially handled to route to a branch specifically
		// to allow faster downloads. Otherwise giget has to download the entire
		// repo and only copy a sub directory
		return `github:chaance/create-chance-app/templates/${tmpl}`;
	} else {
		return `github:chaance/create-chance-app/templates/${tmpl}#${ref}`;
	}
}

async function copyTemplate(tmpl: string, ctx: Context) {
	const templateTarget = getTemplateTarget(tmpl, ctx.ref);
	// Copy
	if (!ctx.dryRun) {
		try {
			await downloadTemplate(templateTarget, {
				force: true,
				cwd: ctx.cwd,
				dir: ".",
			});
		} catch (err: any) {
			// Only remove the directory if it's most likely created by us.
			if (ctx.cwd !== "." && ctx.cwd !== "./" && !ctx.cwd.startsWith("../")) {
				try {
					fs.rmdirSync(ctx.cwd);
				} catch (_) {
					// Ignore any errors from removing the directory,
					// make sure we throw and display the original error.
				}
			}

			if (err.message?.includes("404")) {
				throw new Error(
					`Template ${color.reset(tmpl)} ${color.dim("does not exist!")}`,
				);
			}

			if (err.message) {
				error("error", err.message);
			}
			try {
				// The underlying error is often buried deep in the `cause` property
				// This is in a try/catch block in case of weirdnesses in accessing the `cause` property
				if ("cause" in err) {
					// This is probably included in err.message, but we can log it just in case it has extra info
					error("error", err.cause);
					if ("cause" in err.cause) {
						// Hopefully the actual fetch error message
						error("error", err.cause?.cause);
					}
				}
			} catch {}
			throw new Error(`Unable to download template ${color.reset(tmpl)}`);
		}

		// Post-process in parallel
		const removeFiles = FILES_TO_REMOVE.map(async (file) => {
			const fileLoc = path.resolve(path.join(ctx.cwd, file));
			if (fs.existsSync(fileLoc)) {
				return fs.promises.rm(fileLoc, { recursive: true });
			}
		});
		const updateFiles = Object.entries(FILES_TO_UPDATE).map(
			async ([file, update]) => {
				const fileLoc = path.resolve(path.join(ctx.cwd, file));
				if (fs.existsSync(fileLoc)) {
					return update(fileLoc, { name: ctx.projectName! });
				}
			},
		);

		await Promise.all([...removeFiles, ...updateFiles]);
	}
}

async function installDeps({
	packageManager,
	cwd,
}: {
	packageManager: string;
	cwd: string;
}) {
	if (packageManager === "yarn") {
		// Yarn Berry (PnP) versions will throw an error if there isn't an existing
		// `yarn.lock` file If a `yarn.lock` file doesn't exist, this function
		// writes an empty `yarn.lock` one. Unfortunately this hack is required to
		// run `yarn install`.
		//
		// The empty `yarn.lock` file is immediately overwritten by the installation
		// process. See https://github.com/withastro/astro/pull/8028
		const yarnLock = path.join(cwd, "yarn.lock");
		if (fs.existsSync(yarnLock)) return;
		return fs.promises.writeFile(yarnLock, "", { encoding: "utf-8" });
	}
	return shell(packageManager, ["install"], {
		cwd,
		timeout: 90_000,
		stdio: "ignore",
	});
}

async function initGit({ cwd }: { cwd: string }) {
	try {
		await shell("git", ["init"], { cwd, stdio: "ignore" });
		await shell("git", ["add", "-A"], { cwd, stdio: "ignore" });
		await shell(
			"git",
			[
				"commit",
				"-m",
				'"Initial commit"',
				'--author="Chance Strickland <hi@chance.dev>"',
			],
			{ cwd, stdio: "ignore" },
		);
	} catch {}
}
