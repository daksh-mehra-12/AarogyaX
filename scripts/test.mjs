import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const python = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
const testDatabase = path.join(tmpdir(), `aarogyax-test-${process.pid}.db`);
const backendPath = path.join(projectRoot, "backend");
const requirementsPath = path.join(backendPath, "requirements.txt");
const requirementsHash = createHash("sha256")
  .update(readFileSync(requirementsPath))
  .digest("hex");
const pythonVersion = spawnSync(python, ["-c", "import sys; print(sys.implementation.cache_tag)"], {
  cwd: projectRoot,
  encoding: "utf8",
});
if (pythonVersion.error || pythonVersion.status !== 0) {
  throw pythonVersion.error || new Error("Unable to determine the selected Python version.");
}
const pythonPackages = path.join(
  tmpdir(),
  "aarogya_python_packages",
  `${pythonVersion.stdout.trim()}-${requirementsHash.slice(0, 16)}`,
);
const pythonPath = [pythonPackages, backendPath, projectRoot, process.env.PYTHONPATH]
  .filter(Boolean)
  .join(path.delimiter);
const env = {
  ...process.env,
  AAROGYA_DEFAULT_SEED_PASSWORD: "password123",
  PYTHONPATH: pythonPath,
  PYTHONDONTWRITEBYTECODE: "1",
  SECRET_KEY: "test-only-secret-not-for-deployment",
  TEST_DB_PATH: testDatabase,
};
const pythonTestFiles = [
  "tests/test_cross_user_security.py",
  "tests/test_dynamic_models.py",
  "tests/test_rbac.py",
  "tests/test_amr_module.py",
];
const frontendTestFiles = [
  "src/lib/markdown-parser.test.ts",
  "src/lib/patient-pdf.test.ts",
  "src/lib/patient-vitals.test.ts",
  "src/services/gmail.test.ts",
];

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  return result.status === 0;
}

let passed = true;
try {
  passed = run(process.execPath, [
    path.join(projectRoot, "node_modules", "tsx", "dist", "cli.mjs"),
    "--test",
    ...frontendTestFiles,
  ]);
  if (passed) {
    passed = run(python, [path.join(backendPath, "bootstrap_packages.py")]);
  }
  for (const testFile of pythonTestFiles) {
    if (!passed) break;
    passed = run(python, [path.join(projectRoot, testFile)]);
  }
} catch (error) {
  console.error(error);
  passed = false;
} finally {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    rmSync(`${testDatabase}${suffix}`, { force: true });
  }
}

if (!passed) process.exitCode = 1;
