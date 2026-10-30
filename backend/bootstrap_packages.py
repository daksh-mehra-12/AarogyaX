import os
import sys
import io
import fcntl
import zipfile
import urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))
LEGACY_PY_PKGS = os.path.join(PROJECT_ROOT, ".python_packages")
PY_PKGS = "/tmp/aarogya_python_packages"
READY_MARKER = os.path.join(PY_PKGS, ".ready_v4")
LOCK_FILE = "/tmp/aarogya_py_bootstrap.lock"

os.makedirs(PY_PKGS, exist_ok=True)

# Remove corrupted legacy .python_packages from sys.path if present
sys.path[:] = [
    p for p in sys.path
    if os.path.abspath(p) != LEGACY_PY_PKGS and not p.endswith(".python_packages")
]

for p in (PROJECT_ROOT, BASE_DIR, PY_PKGS):
    if p not in sys.path:
        sys.path.insert(0, p)

REQUIRED_WHEELS = [
    (
        "typing_extensions.py",
        "https://files.pythonhosted.org/packages/49/d3/b8441a820a491ddfc024b0b0cf0393375b75ea13866d9c66727e54c2fc80/typing_extensions-4.16.0-py3-none-any.whl",
    ),
    (
        "annotated_types/__init__.py",
        "https://files.pythonhosted.org/packages/99/91/8acff4f5e50511b911bbccb72b8628a49c68ce14148cd9f6431094859a90/annotated_types-0.8.0-py3-none-any.whl",
    ),
    (
        "pydantic_core/__init__.py",
        "https://files.pythonhosted.org/packages/32/90/3b15e31b88ca39e9e626630b4c4a1f5a0dfd09076366f4219429e6786076/pydantic_core-2.27.2-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl",
    ),
    (
        "pydantic/__init__.py",
        "https://files.pythonhosted.org/packages/f4/3c/8cc1cc84deffa6e25d2d0c688ebb80635dfdbf1dbea3e30c541c8cf4d860/pydantic-2.10.6-py3-none-any.whl",
    ),
    (
        "sniffio/__init__.py",
        "https://files.pythonhosted.org/packages/e9/44/75a9c9421471a6c4805dbf2356f7c181a29c1879239abab1ea2cc8f38b40/sniffio-1.3.1-py3-none-any.whl",
    ),
    (
        "exceptiongroup/__init__.py",
        "https://files.pythonhosted.org/packages/8a/0e/97c33bf5009bdbac74fd2beace167cab3f978feb69cc36f1ef79360d6c4e/exceptiongroup-1.3.1-py3-none-any.whl",
    ),
    (
        "idna/idnadata.py",
        "https://files.pythonhosted.org/packages/58/a2/bb081bab032533a855d44de1d56f8e8426114ff1ba5d1f07a438a0a654f8/idna-3.20-py3-none-any.whl",
    ),
    (
        "anyio/__init__.py",
        "https://files.pythonhosted.org/packages/12/b8/4bd346e22b28902df4d651910f5242c28d84e4a5c2435ca5c3f797ed7e2e/anyio-4.15.1-py3-none-any.whl",
    ),
    (
        "starlette/routing.py",
        "https://files.pythonhosted.org/packages/d9/61/f2b52e107b1fc8944b33ef56bf6ac4ebbe16d91b94d2b87ce013bf63fb84/starlette-0.45.3-py3-none-any.whl",
    ),
    (
        "fastapi/routing.py",
        "https://files.pythonhosted.org/packages/8f/7d/2d6ce181d7a5f51dedb8c06206cbf0ec026a99bf145edd309f9e17c3282f/fastapi-0.115.8-py3-none-any.whl",
    ),
    (
        "h11/_util.py",
        "https://files.pythonhosted.org/packages/04/4b/29cac41a4d98d144bf5f6d33995617b185d14b22401f75ca86f384e87ff1/h11-0.16.0-py3-none-any.whl",
    ),
    (
        "click/__init__.py",
        "https://files.pythonhosted.org/packages/58/50/6c0d534c5f134586a8e1ba4e330569e32f057e33372ae556463212fb4cd3/click-8.5.0-py3-none-any.whl",
    ),
    (
        "uvicorn/main.py",
        "https://files.pythonhosted.org/packages/61/14/33a3a1352cfa71812a3a21e8c9bfb83f60b0011f5e36f2b1399d51928209/uvicorn-0.34.0-py3-none-any.whl",
    ),
    (
        "greenlet/__init__.py",
        "https://files.pythonhosted.org/packages/fb/2f/3850b867a9af519794784a7eeed1dd5bc68ffbcc5b28cef703711025fd0a/greenlet-3.1.1-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl",
    ),
    (
        "sqlalchemy/util/__init__.py",
        "https://files.pythonhosted.org/packages/a9/99/505feb8a9bc7027addaa2b312b8b306319cacbbd8a5231c4123ca1fa082a/SQLAlchemy-2.0.38-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl",
    ),
    (
        "markupsafe/__init__.py",
        "https://files.pythonhosted.org/packages/22/35/137da042dfb4720b638d2937c38a9c2df83fe32d20e8c8f3185dbfef05f7/MarkupSafe-3.0.2-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl",
    ),
    (
        "werkzeug/security.py",
        "https://files.pythonhosted.org/packages/a1/38/df03f564f43cec2684823f3cccae1a652ee7face1cbaa76fb223096e64d7/werkzeug-3.1.9-py3-none-any.whl",
    ),
    (
        "jwt/__init__.py",
        "https://files.pythonhosted.org/packages/50/ca/44de4e75f8aadc457f0634be3b542815078ded46dca30efb960edeecad6e/pyjwt-2.15.1-py3-none-any.whl",
    ),
    (
        "joblib/externals/cloudpickle/__init__.py",
        "https://files.pythonhosted.org/packages/91/29/df4b9b42f2be0b623cbd5e2140cafcaa2bef0759a00b7b70104dcfe2fb51/joblib-1.4.2-py3-none-any.whl",
    ),
    (
        "threadpoolctl.py",
        "https://files.pythonhosted.org/packages/43/3f/f88a53f60a472b46f4023f56d204dd7de33d34c5d2acbfa0d70a674e639e/threadpoolctl-3.7.0-py3-none-any.whl",
    ),
    (
        "numpy/exceptions.py",
        "https://files.pythonhosted.org/packages/b4/63/3de6a34ad7ad6646ac7d2f55ebc6ad439dbbf9c4370017c50cf403fb19b5/numpy-2.2.6-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl",
    ),
    (
        "scipy/sparse/__init__.py",
        "https://files.pythonhosted.org/packages/47/78/b0c2c23880dd1e99e938ad49ccfb011ae353758a2dc5ed7ee59baff684c3/scipy-1.14.1-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl",
    ),
    (
        "sklearn/ensemble/__init__.py",
        "https://files.pythonhosted.org/packages/b7/91/ab3c697188f224d658969f678be86b0968ccc52774c8ab4a86a07be13c25/scikit_learn-1.6.1-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl",
    ),
    (
        "six.py",
        "https://files.pythonhosted.org/packages/b7/ce/149a00dd41f10bc29e5921b496af8b574d8413afcd5e30dfa0ed46c2cc5e/six-1.17.0-py2.py3-none-any.whl",
    ),
    (
        "pytz/__init__.py",
        "https://files.pythonhosted.org/packages/4f/ef/c66110d46fb800dda0bf33164182dfadabe26a90e4476844d502a23dca8e/pytz-2026.5-py2.py3-none-any.whl",
    ),
    (
        "tzdata/__init__.py",
        "https://files.pythonhosted.org/packages/0a/66/9a06c2227fedfd4919f0eaaa8b94377d9730882a7e4f95823c9a331ab5e1/tzdata-2026.6-py2.py3-none-any.whl",
    ),
    (
        "dateutil/tz/tz.py",
        "https://files.pythonhosted.org/packages/5a/17/cebee01d1c0c1441174cf0456ddc91b280d79acb65340c05e41d77866ee8/python_dateutil-3.0.0-py2.py3-none-any.whl",
    ),
    (
        "pandas/core/api.py",
        "https://files.pythonhosted.org/packages/44/50/7db2cd5e6373ae796f0ddad3675268c8d59fb6076e66f0c339d61cea886b/pandas-2.2.3-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl",
    ),
    (
        "PIL/Image.py",
        "https://files.pythonhosted.org/packages/02/80/79f99b714f0fc25f6a8499ecfd1f810df12aec170ea1e32a4f75746051ce/pillow-11.1.0-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl",
    ),
    (
        "reportlab/platypus/__init__.py",
        "https://files.pythonhosted.org/packages/93/6c/8aa58c1458a34db7d79adecbdedaa3ab4c8b095850ec3dbba389e28fbe8d/reportlab-3.6.9-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl",
    ),
    (
        "certifi/__init__.py",
        "https://files.pythonhosted.org/packages/32/d1/a3652fe2c19134d0d15922177821d863cbd7e842d53a21bbe7e8e3a1b5ac/certifi-2026.10.23-py3-none-any.whl",
    ),
    (
        "httpcore/__init__.py",
        "https://files.pythonhosted.org/packages/7e/f5/f66802a942d491edb555dd61e3a9961140fd64c90bce1eafd741609d334d/httpcore-1.0.9-py3-none-any.whl",
    ),
    (
        "httpx/_utils.py",
        "https://files.pythonhosted.org/packages/2a/39/e50c7c3a983047577ee07d2a9e53faf5a69493943ec3f6a384bdc792deb2/httpx-0.28.1-py3-none-any.whl",
    ),
]


def _has_sentinel(rel_path: str) -> bool:
    full = os.path.join(PY_PKGS, rel_path)
    return os.path.isfile(full) and os.path.getsize(full) > 0


def _atomic_extract_wheel(item):
    sentinel, url = item
    print(f"[Bootstrap] Installing wheel for {sentinel}...", flush=True)
    req = urllib.request.urlopen(url, timeout=60)
    data = req.read()
    pid = os.getpid()
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        for member in z.infolist():
            if member.is_dir():
                os.makedirs(os.path.join(PY_PKGS, member.filename), exist_ok=True)
                continue
            target_path = os.path.join(PY_PKGS, member.filename)
            os.makedirs(os.path.dirname(target_path), exist_ok=True)
            tmp_path = f"{target_path}.tmp.{pid}"
            with z.open(member) as src, open(tmp_path, "wb") as dst:
                dst.write(src.read())
            os.replace(tmp_path, target_path)
    print(f"[Bootstrap] Extracted {sentinel} OK", flush=True)


def ensure_packages():
    if os.path.isfile(READY_MARKER) and all(_has_sentinel(s) for s, _ in REQUIRED_WHEELS):
        return

    with open(LOCK_FILE, "w") as lock_fp:
        fcntl.flock(lock_fp, fcntl.LOCK_EX)
        try:
            missing = [(s, u) for s, u in REQUIRED_WHEELS if not _has_sentinel(s)]
            if missing:
                print(f"[Bootstrap] Provisioning {len(missing)} clean Python package(s) in {PY_PKGS}...", flush=True)
                with ThreadPoolExecutor(max_workers=8) as pool:
                    list(pool.map(_atomic_extract_wheel, missing))
            with open(READY_MARKER, "w") as f:
                f.write("ok\n")
        finally:
            fcntl.flock(lock_fp, fcntl.LOCK_UN)


if __name__ == "__main__":
    ensure_packages()
    print("[Bootstrap] All backend Python packages verified in /tmp/aarogya_python_packages!", flush=True)
