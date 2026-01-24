import os
import shutil
import subprocess
from htmlmin import minify
from csscompressor import compress
from jsmin import jsmin

BACKEND_DIR = "backend"
FRONTEND_DIR = "frontend"
DIST_DIR = "dist"

def optimize_backend():
    print("🔧 تحسين Backend...")
    subprocess.run(["autoflake", "--in-place", "--remove-all-unused-imports", "-r", BACKEND_DIR])
    subprocess.run(["black", BACKEND_DIR])
    subprocess.run(["ruff", BACKEND_DIR, "--fix"])
    print("✅ تم تحسين Backend")

def optimize_frontend():
    print("🎨 تحسين Frontend...")

    if os.path.exists(DIST_DIR):
        shutil.rmtree(DIST_DIR)

    for root, _, files in os.walk(FRONTEND_DIR):
        for file in files:
            src = os.path.join(root, file)
            rel = os.path.relpath(src, FRONTEND_DIR)
            dst = os.path.join(DIST_DIR, rel)

            os.makedirs(os.path.dirname(dst), exist_ok=True)

            with open(src, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()

            if file.endswith(".html"):
                content = minify(content, remove_comments=True)
            elif file.endswith(".css"):
                content = compress(content)
            elif file.endswith(".js"):
                content = jsmin(content)

            with open(dst, "w", encoding="utf-8") as f:
                f.write(content)
    
    print("✅ تم تحسين Frontend")

def main():
    optimize_backend()
    optimize_frontend()
    print("🎉 اكتمل تحسين المشروع بنجاح!")

if __name__ == "__main__":
    main()
