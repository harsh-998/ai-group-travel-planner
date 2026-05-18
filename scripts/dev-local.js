const { spawn, spawnSync } = require("child_process");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const npmCmd = "npm";

const children = [];

const buildEnv = (extra = {}) => {
  const env = {};
  const seen = new Set();
  let pathValue = null;

  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined || value === null) continue;

    const normalizedKey = process.platform === "win32" ? key.toUpperCase() : key;
    if (process.platform === "win32" && normalizedKey === "PATH") {
      pathValue = pathValue || value;
      continue;
    }

    if (!seen.has(normalizedKey)) {
      env[key] = value;
      seen.add(normalizedKey);
    }
  }

  if (process.platform === "win32" && pathValue) {
    env.Path = pathValue;
  }

  return {
    ...env,
    REQUIRE_DB: process.env.REQUIRE_DB || "false",
    PORT: process.env.PORT || "5000",
    VITE_API_URL: process.env.VITE_API_URL || "http://localhost:5000",
    ...extra
  };
};

const startMongo = () => {
  if (process.platform !== "win32") {
    console.warn("[mongo] Skipping helper script on non-Windows platforms. Start mongod manually if DB routes are needed.");
    return;
  }

  const result = spawnSync(
    "powershell",
    ["-ExecutionPolicy", "Bypass", "-File", path.join(repoRoot, "scripts", "start-local-mongodb.ps1")],
    {
      cwd: repoRoot,
      stdio: "inherit"
    }
  );

  if (result.status !== 0) {
    console.warn("[mongo] MongoDB helper did not start a local database. The API will still boot with REQUIRE_DB=false.");
  }
};

const startProcess = (name, args, options = {}) => {
  const child = spawn(npmCmd, args, {
    cwd: repoRoot,
    env: buildEnv(options.env),
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.log(`[${name}] exited with ${signal || code}`);
    shutdown(code || 0);
  });

  children.push(child);
  return child;
};

let shuttingDown = false;

const shutdown = (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) child.kill();
  }

  setTimeout(() => process.exit(code), 250);
};

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log("Starting WayFinder local development...");
startMongo();

console.log("Backend:  http://localhost:5000");
console.log("Frontend: http://127.0.0.1:5173");

startProcess("server", ["--prefix", "server", "run", "dev"]);
startProcess("client", ["--prefix", "client", "run", "dev"]);
