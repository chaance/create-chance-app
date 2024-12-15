import type { ChildProcess, StdioOptions } from "node:child_process";
import type { Readable } from "node:stream";
import { spawn } from "node:child_process";
import { text as textFromStream } from "node:stream/consumers";
import { stripVTControlCharacters } from "node:util";
import {
	color,
	say as houston,
	label,
	spinner as load,
	type prompt,
	type Task,
} from "@astrojs/cli-kit";
import { align, sleep } from "@astrojs/cli-kit/utils";

let stdout = process.stdout;
/** @internal Used to mock `process.stdout.write` for testing purposes */
export function setStdout(writable: typeof process.stdout) {
	stdout = writable;
}

export async function say(
	messages: string | string[],
	{ clear = false, hat = "", tie = "" } = {},
) {
	return houston(messages, { clear, hat, tie, stdout });
}

export async function spinner(args: {
	start: string;
	end: string;
	onError?: (error: any) => void;
	while: (...args: any) => Promise<any>;
}) {
	await load(args, { stdout });
}

export function title(text: string) {
	return align(label(text), "end", 7) + " ";
}

export function getVersion(
	packageManager: string,
	packageName: string,
	fallback = "",
) {
	return new Promise<string>(async (resolve) => {
		let registry = await getRegistry(packageManager);
		const { version } = await fetch(`${registry}/${packageName}/latest`, {
			redirect: "follow",
		})
			.then((res) => res.json())
			.catch(() => ({ version: fallback }));
		return resolve(version);
	});
}

export function log(message: string) {
	return stdout.write(message + "\n");
}

export function banner() {
	const prefix = `astro`;
	const suffix = `Launch sequence initiated.`;
	log(`${label(prefix, color.bgGreen, color.black)}  ${suffix}`);
}

export function bannerAbort() {
	return log(
		`\n${label("astro", color.bgRed)} ${color.bold("Launch sequence aborted.")}`,
	);
}

export async function info(prefix: string, text: string) {
	await sleep(100);
	if (stdout.columns < 80) {
		log(`${" ".repeat(5)} ${color.cyan("◼")}  ${color.cyan(prefix)}`);
		log(`${" ".repeat(9)}${color.dim(text)}`);
	} else {
		log(
			`${" ".repeat(5)} ${color.cyan("◼")}  ${color.cyan(prefix)} ${color.dim(text)}`,
		);
	}
}

export async function error(prefix: string, text: string) {
	if (stdout.columns < 80) {
		log(`${" ".repeat(5)} ${color.red("▲")}  ${color.red(prefix)}`);
		log(`${" ".repeat(9)}${color.dim(text)}`);
	} else {
		log(
			`${" ".repeat(5)} ${color.red("▲")}  ${color.red(prefix)} ${color.dim(text)}`,
		);
	}
}

export async function typescriptByDefault() {
	await info(`No worries!`, "TypeScript is supported by default,");
	log(
		`${" ".repeat(9)}${color.dim("but you are free to continue writing JavaScript instead.")}`,
	);
	await sleep(1000);
}

export async function nextSteps({
	projectDir,
	devCmd,
}: {
	projectDir: string;
	devCmd: string;
}) {
	const max = stdout.columns;
	const prefix = max < 80 ? " " : " ".repeat(9);
	await sleep(200);
	log(
		`\n ${color.bgCyan(` ${color.black("next")} `)}  ${color.bold(
			"Liftoff confirmed. Explore your project!",
		)}`,
	);

	await sleep(100);
	if (projectDir !== "") {
		projectDir = projectDir.includes(" ")
			? `"./${projectDir}"`
			: `./${projectDir}`;
		const enter = [
			`\n${prefix}Enter your project directory using`,
			color.cyan(`cd ${projectDir}`, ""),
		];
		const len = enter[0].length + stripVTControlCharacters(enter[1]).length;
		log(enter.join(len > max ? "\n" + prefix : " "));
	}
	log(
		`${prefix}Run ${color.cyan(devCmd)} to start the dev server. ${color.cyan("CTRL+C")} to stop.`,
	);
	await sleep(100);
	log(
		`${prefix}Add frameworks like ${color.cyan(`react`)} or ${color.cyan(
			"tailwind",
		)} using ${color.cyan("astro add")}.`,
	);
	await sleep(100);
	log(`\n${prefix}Stuck? Join us at ${color.cyan(`https://astro.build/chat`)}`);
	await sleep(200);
}

export function printHelp({
	commandName,
	headline,
	usage,
	tables,
	description,
}: {
	commandName: string;
	headline?: string;
	usage?: string;
	tables?: Record<string, [command: string, help: string][]>;
	description?: string;
}) {
	const linebreak = () => "";
	const table = (
		rows: [string, string][],
		{ padding }: { padding: number },
	) => {
		const split = stdout.columns < 60;
		let raw = "";

		for (const row of rows) {
			if (split) {
				raw += `    ${row[0]}\n    `;
			} else {
				raw += `${`${row[0]}`.padStart(padding)}`;
			}
			raw += "  " + color.dim(row[1]) + "\n";
		}

		return raw.slice(0, -1); // remove latest \n
	};

	let message = [];

	if (headline) {
		message.push(
			linebreak(),
			`${title(commandName)} ${color.green(`v${process.env.PACKAGE_VERSION ?? ""}`)} ${headline}`,
		);
	}

	if (usage) {
		message.push(
			linebreak(),
			`${color.green(commandName)} ${color.bold(usage)}`,
		);
	}

	if (tables) {
		function calculateTablePadding(rows: [string, string][]) {
			return rows.reduce((val, [first]) => Math.max(val, first.length), 0);
		}
		const tableEntries = Object.entries(tables);
		const padding = Math.max(
			...tableEntries.map(([, rows]) => calculateTablePadding(rows)),
		);
		for (const [, tableRows] of tableEntries) {
			message.push(linebreak(), table(tableRows, { padding }));
		}
	}

	if (description) {
		message.push(linebreak(), `${description}`);
	}

	log(message.join("\n") + "\n");
}

// Users might lack access to the global npm registry, this function
// checks the user's project type and will return the proper npm registry
let _registry: string;
export async function getRegistry(packageManager: string): Promise<string> {
	if (_registry) return _registry;
	const fallback = "https://registry.npmjs.org";
	try {
		const { stdout } = await shell(packageManager, [
			"config",
			"get",
			"registry",
		]);
		_registry = stdout?.trim()?.replace(/\/$/, "") || fallback;
		// Detect cases where the shell command returned a non-URL (e.g. a warning)
		if (!new URL(_registry).host) _registry = fallback;
	} catch {
		_registry = fallback;
	}
	return _registry;
}

export function detectPackageManager() {
	if (!process.env.npm_config_user_agent) return;
	const specifier = process.env.npm_config_user_agent.split(" ")[0];
	const name = specifier.substring(0, specifier.lastIndexOf("/"));
	return name === "npminstall" ? "cnpm" : name;
}

export interface Context {
	help: boolean;
	prompt: typeof prompt;
	cwd: string;
	packageManager: string;
	version: Promise<string>;
	skipAnimation: boolean;
	fancy?: boolean;
	dryRun?: boolean;
	yes?: boolean;
	projectName?: string;
	template?: string;
	ref: string;
	install?: boolean;
	git?: boolean;
	typescript?: string;
	stdin?: typeof process.stdin;
	stdout?: typeof process.stdout;
	exit(code: number): never;
	welcome?: string;
	hat?: string;
	tie?: string;
	tasks: Task[];
}

// This is an extremely simplified version of [`execa`](https://github.com/sindresorhus/execa)
// intended to keep our dependency size down

interface ShellOptions {
	cwd?: string | URL;
	stdio?: StdioOptions;
	timeout?: number;
}

interface ShellOutput {
	stdout: string;
	stderr: string;
	exitCode: number;
}

export async function shell(
	command: string,
	flags: string[],
	opts: ShellOptions = {},
): Promise<ShellOutput> {
	let child: ChildProcess;
	let stdout = "";
	let stderr = "";
	try {
		child = spawn(command, flags, {
			cwd: opts.cwd,
			shell: true,
			stdio: opts.stdio,
			timeout: opts.timeout,
		});
		const done = new Promise((resolve) => child.on("close", resolve));
		[stdout, stderr] = await Promise.all([
			text(child.stdout),
			text(child.stderr),
		]);
		await done;
	} catch {
		throw { stdout, stderr, exitCode: 1 };
	}
	const { exitCode } = child;
	if (exitCode === null) {
		throw new Error("Timeout");
	}
	if (exitCode !== 0) {
		throw new Error(stderr);
	}
	return { stdout, stderr, exitCode };
}

function text(stream: NodeJS.ReadableStream | Readable | null) {
	return stream ? textFromStream(stream).then((t) => t.trimEnd()) : "";
}
