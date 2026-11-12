import { spawn, execFile } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));

// An empty folder the CLIs run in, so they never pick up a project's CLAUDE.md or AGENTS.md.
export const SANDBOX_DIR = path.resolve(here, "..", "..", ".sandbox");
mkdirSync(SANDBOX_DIR, { recursive: true });

// Kill a process and its children. On Windows, a shell-launched CLI is a tree.
export function killTree(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") {
    execFile("taskkill", ["/PID", String(child.pid), "/T", "/F"], () => {});
  } else {
    child.kill("SIGTERM");
  }
}

// Run a CLI, write `input` to its stdin, and call onLine for each stdout line.
export function runLines(cmd, args, { input, onLine, signal, shell = false, timeoutMs = 300_000 }) {
  return new Promise((resolve, reject) => {
    // detached: each CLI gets its own (hidden) console. Claude sends Ctrl+C to its console group when it
    // closes MCP servers; sharing the scheduled task's console, that Ctrl+C also stopped Envi (exit 0xC000013A).
    const child = spawn(cmd, args, { cwd: SANDBOX_DIR, shell, windowsHide: true, detached: process.platform === "win32", env: process.env });
    let buf = "", errBuf = "", done = false, lineErr = null;   // lineErr: a deliberate error a provider raised from a line (e.g. "usage limit")
    const finish = (fn, val) => { if (done) return; done = true; clearTimeout(timer); signal?.removeEventListener("abort", onAbort); fn(val); };
    const onAbort = () => { killTree(child); finish(reject, Object.assign(new Error("cancelled"), { code: "cancelled" })); };
    const timer = setTimeout(() => { killTree(child); finish(reject, Object.assign(new Error("The model took too long to answer."), { code: "timeout" })); }, timeoutMs);
    if (signal) { if (signal.aborted) return onAbort(); signal.addEventListener("abort", onAbort, { once: true }); }

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (line) { try { onLine(line); } catch (e) { if (e.code && !lineErr) lineErr = e; console.error("[provider] line handler:", e.message); } }
      }
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (c) => { errBuf = (errBuf + c).slice(-4000); });
    child.on("error", (e) => finish(reject, Object.assign(new Error(`Could not start ${cmd}: ${e.message}`), { code: "not_installed" })));
    child.on("close", (code) => {
      if (buf.trim()) { try { onLine(buf.trim()); } catch {} }
      if (lineErr) finish(reject, lineErr);
      else if (code === 0) finish(resolve);
      else finish(reject, Object.assign(new Error(errBuf.trim().split("\n").slice(-3).join(" ") || `${cmd} exited with code ${code}`), { code: "cli_error" }));
    });
    child.stdin.on("error", () => {});
    child.stdin.end(input ?? "");
  });
}

// Turn chat turns into one transcript for single-shot CLIs.
export function transcript(messages) {
  return messages
    .map((m) => `${m.role === "assistant" ? "ENVI" : "KUNAL"}: ${m.content}`)
    .join("\n\n") + "\n\nENVI:";
}
