const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");

let isShuttingDown = false;
let pendingExitCode = 0;

const processes = [
  startProcess("server", path.join(rootDir, "Server")),
  startProcess("client", path.join(rootDir, "Client")),
];

function startProcess(name, cwd) {
  const invocation = getNpmInvocation();

  const child = spawn(invocation.command, invocation.args, {
    cwd,
    env: {
      ...process.env,
      FORCE_COLOR: process.env.FORCE_COLOR ?? "1",
    },
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (isShuttingDown) {
      maybeExit(code, signal);
      return;
    }

    pendingExitCode = code ?? (signal ? 1 : 0);
    const reason =
      code !== null ? `exit code ${code}` : `signal ${signal ?? "unknown"}`;
    console.log(`[runner] ${name} stopped with ${reason}. Shutting down the other process.`);
    shutdownAll(name);
  });

  child.on("error", (error) => {
    if (isShuttingDown) {
      return;
    }

    pendingExitCode = 1;
    console.error(`[runner] Failed to start ${name}: ${error.message}`);
    shutdownAll(name);
  });

  return { name, child };
}

function getNpmInvocation() {
  return {
    command: process.execPath,
    args: [getNpmCliPath(), "run", "dev"],
  };
}

function getNpmCliPath() {
  const candidates = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
  ].filter(Boolean);

  const npmCliPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!npmCliPath) {
    throw new Error("Unable to locate npm CLI. Run this script through npm or ensure npm is installed.");
  }

  return npmCliPath;
}

function shutdownAll(origin) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  for (const processInfo of processes) {
    if (processInfo.name === origin) {
      continue;
    }

    stopProcess(processInfo.child);
  }
}

function stopProcess(child) {
  if (!child.pid || child.killed) {
    return;
  }

  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });

    killer.on("error", () => {
      try {
        child.kill("SIGTERM");
      } catch {}
    });

    return;
  }

  try {
    child.kill("SIGTERM");
  } catch {}
}

function maybeExit(code, signal) {
  const anyRunning = processes.some(({ child }) => child.exitCode === null && !child.killed);
  if (anyRunning) {
    return;
  }

  if (pendingExitCode === 0) {
    pendingExitCode = code ?? (signal ? 1 : 0);
  }

  process.exit(pendingExitCode);
}

function handleSignal(signal) {
  if (isShuttingDown) {
    return;
  }

  pendingExitCode = 0;
  console.log(`[runner] Received ${signal}. Stopping client and server.`);
  shutdownAll();
}

process.on("SIGINT", () => handleSignal("SIGINT"));
process.on("SIGTERM", () => handleSignal("SIGTERM"));
