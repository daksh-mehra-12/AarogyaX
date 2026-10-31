import hashlib
import os
import subprocess
import sys
import tempfile

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))
REQUIREMENTS_FILE = os.path.join(BASE_DIR, "requirements.txt")
with open(REQUIREMENTS_FILE, "rb") as requirements_file:
    REQUIREMENTS_HASH = hashlib.sha256(requirements_file.read()).hexdigest()
PY_PKGS = os.path.join(
    tempfile.gettempdir(),
    "aarogya_python_packages",
    f"{sys.implementation.cache_tag}-{REQUIREMENTS_HASH[:16]}",
)
READY_MARKER = os.path.join(PY_PKGS, ".ready_requirements_v1")
LOCK_FILE = os.path.join(tempfile.gettempdir(), "aarogya_py_bootstrap.lock")

for path in (PROJECT_ROOT, BASE_DIR, PY_PKGS):
    if path not in sys.path:
        sys.path.insert(0, path)


def _lock(lock_file):
    if os.name == "nt":
        import msvcrt

        lock_file.seek(0, os.SEEK_END)
        if lock_file.tell() == 0:
            lock_file.write(b"\0")
            lock_file.flush()
        lock_file.seek(0)
        msvcrt.locking(lock_file.fileno(), msvcrt.LK_LOCK, 1)
    else:
        import fcntl

        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)


def _unlock(lock_file):
    if os.name == "nt":
        import msvcrt

        lock_file.seek(0)
        msvcrt.locking(lock_file.fileno(), msvcrt.LK_UNLCK, 1)
    else:
        import fcntl

        fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)


def ensure_packages():
    if os.environ.get("AAROGYA_PREINSTALLED_PACKAGES") == "1":
        return
    os.makedirs(PY_PKGS, exist_ok=True)
    expected_marker = f"{sys.implementation.cache_tag}:{REQUIREMENTS_HASH}"
    if _is_ready(expected_marker):
        return

    with open(LOCK_FILE, "a+b") as lock_file:
        _lock(lock_file)
        try:
            if _is_ready(expected_marker):
                return

            print(f"[Bootstrap] Installing backend packages in {PY_PKGS}...", flush=True)
            subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "pip",
                    "install",
                    "--disable-pip-version-check",
                    "--upgrade",
                    "--target",
                    PY_PKGS,
                    "-r",
                    REQUIREMENTS_FILE,
                ],
                check=True,
            )
            with open(READY_MARKER, "w", encoding="utf-8") as marker:
                marker.write(f"{expected_marker}\n")
        finally:
            _unlock(lock_file)


def _is_ready(expected_marker):
    try:
        with open(READY_MARKER, encoding="utf-8") as marker:
            return marker.read().strip() == expected_marker
    except FileNotFoundError:
        return False


if __name__ == "__main__":
    ensure_packages()
    print("[Bootstrap] Backend packages verified.", flush=True)
