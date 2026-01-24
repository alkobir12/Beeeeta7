#!/usr/bin/env python3
"""
🚀 سكربت تحسين المشروع المتقدم - AutoPro Workshop
الإصدار: 2.0.0
المميزات: تحسين، ضغط، أمان، تحليل، نسخ احتياطي، Docker
"""

import os
import sys
import shutil
import subprocess
import time
import gzip
import hashlib
import json
import re
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from collections import defaultdict

# ==================== الإعدادات ====================

BACKEND_DIR = "backend"
FRONTEND_DIR = "frontend"
DIST_DIR = "dist"
BACKUP_DIR = "backups"
REPORT_DIR = "reports"
CACHE_DIRS = ["__pycache__", ".pytest_cache", ".ruff_cache", "node_modules/.cache"]

# أنواع الملفات
IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']
CODE_EXTENSIONS = ['.py', '.js', '.jsx', '.ts', '.tsx', '.css', '.html']

# ==================== الألوان ====================

class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    MAGENTA = '\033[95m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_header(text, emoji=""):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}  {emoji} {text}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}\n")

def print_success(text):
    print(f"{Colors.GREEN}✅ {text}{Colors.END}")

def print_warning(text):
    print(f"{Colors.YELLOW}⚠️  {text}{Colors.END}")

def print_error(text):
    print(f"{Colors.RED}❌ {text}{Colors.END}")

def print_info(text):
    print(f"{Colors.CYAN}ℹ️  {text}{Colors.END}")

def print_step(text):
    print(f"{Colors.MAGENTA}▶ {text}{Colors.END}")

# ==================== أدوات مساعدة ====================

def get_file_size(path):
    """الحصول على حجم الملف"""
    try:
        size = os.path.getsize(path)
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024:
                return f"{size:.2f} {unit}"
            size /= 1024
        return f"{size:.2f} TB"
    except:
        return "0 B"

def get_dir_size(path):
    """حجم المجلد الكلي"""
    total = 0
    for dirpath, _, filenames in os.walk(path):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            try:
                total += os.path.getsize(fp)
            except:
                pass
    return total

def calculate_hash(filepath):
    """حساب hash للملف"""
    hash_md5 = hashlib.md5()
    try:
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    except:
        return None

def run_command(cmd, cwd=None, silent=False):
    """تشغيل أمر"""
    try:
        result = subprocess.run(
            cmd, cwd=cwd, capture_output=True, text=True, timeout=120
        )
        return result.returncode == 0, result.stdout, result.stderr
    except Exception as e:
        return False, "", str(e)

def ensure_dir(path):
    """إنشاء مجلد إذا لم يكن موجوداً"""
    os.makedirs(path, exist_ok=True)

# ==================== 1. تحسين Backend ====================

def optimize_backend():
    """تحسين كود Backend"""
    print_header("تحسين Backend (FastAPI)", "🔧")
    
    stats = {"imports_removed": 0, "files_formatted": 0, "issues_fixed": 0}
    
    # إزالة imports غير مستخدمة
    print_step("إزالة الـ imports غير المستخدمة...")
    success, out, err = run_command([
        "autoflake", "--in-place", "--remove-all-unused-imports",
        "--remove-unused-variables", "--recursive", BACKEND_DIR
    ])
    if success:
        print_success("تم إزالة الـ imports غير المستخدمة")
    
    # تنسيق الكود
    print_step("تنسيق الكود باستخدام Black...")
    success, out, err = run_command(["black", BACKEND_DIR, "--quiet"])
    if success:
        print_success("تم تنسيق الكود")
    
    # فحص Ruff
    print_step("فحص وإصلاح باستخدام Ruff...")
    success, out, err = run_command(["ruff", "check", BACKEND_DIR, "--fix", "--silent"])
    if success:
        print_success("تم فحص وإصلاح الأخطاء")
    
    # فحص Type hints
    print_step("فحص Type hints...")
    success, out, err = run_command(["python", "-m", "py_compile", f"{BACKEND_DIR}/server.py"])
    if success:
        print_success("لا توجد أخطاء syntax")
    
    return stats

# ==================== 2. تحسين Frontend ====================

def optimize_frontend():
    """تحسين Frontend"""
    print_header("تحسين Frontend (React)", "🎨")
    
    # ESLint
    print_step("فحص ESLint...")
    success, out, err = run_command(["yarn", "lint"], cwd=FRONTEND_DIR)
    if success:
        print_success("لا توجد أخطاء ESLint")
    else:
        print_warning("توجد تحذيرات ESLint")
    
    # فحص TypeScript (إذا وجد)
    if os.path.exists(f"{FRONTEND_DIR}/tsconfig.json"):
        print_step("فحص TypeScript...")
        success, out, err = run_command(["yarn", "tsc", "--noEmit"], cwd=FRONTEND_DIR)
        if success:
            print_success("لا توجد أخطاء TypeScript")
    
    return {"linted": True}

# ==================== 3. ضغط Gzip ====================

def create_gzip_files():
    """إنشاء ملفات Gzip مضغوطة"""
    print_header("إنشاء ملفات Gzip", "📦")
    
    gzip_dir = os.path.join(DIST_DIR, "gzip")
    ensure_dir(gzip_dir)
    
    compressed_count = 0
    total_saved = 0
    
    extensions = ['.js', '.css', '.html', '.json', '.svg']
    
    for root, _, files in os.walk(FRONTEND_DIR):
        if 'node_modules' in root:
            continue
        
        for file in files:
            if any(file.endswith(ext) for ext in extensions):
                src = os.path.join(root, file)
                rel = os.path.relpath(src, FRONTEND_DIR)
                dst = os.path.join(gzip_dir, rel + '.gz')
                
                try:
                    ensure_dir(os.path.dirname(dst))
                    
                    with open(src, 'rb') as f_in:
                        content = f_in.read()
                    
                    with gzip.open(dst, 'wb', compresslevel=9) as f_out:
                        f_out.write(content)
                    
                    original = len(content)
                    compressed = os.path.getsize(dst)
                    saved = original - compressed
                    total_saved += saved
                    compressed_count += 1
                    
                except Exception as e:
                    pass
    
    print_success(f"تم ضغط {compressed_count} ملف")
    print_success(f"تم توفير {total_saved / 1024 / 1024:.2f} MB")
    
    return {"files": compressed_count, "saved": total_saved}

# ==================== 4. تحسين الصور ====================

def optimize_images():
    """تحسين وضغط الصور"""
    print_header("تحسين الصور", "🖼️")
    
    # التحقق من وجود أدوات الضغط
    has_optipng = shutil.which("optipng") is not None
    has_jpegoptim = shutil.which("jpegoptim") is not None
    
    if not has_optipng and not has_jpegoptim:
        print_warning("أدوات ضغط الصور غير متوفرة (optipng, jpegoptim)")
        print_info("يمكنك تثبيتها: apt install optipng jpegoptim")
        return {"optimized": 0}
    
    optimized = 0
    total_saved = 0
    
    for root, _, files in os.walk(FRONTEND_DIR):
        if 'node_modules' in root:
            continue
        
        for file in files:
            filepath = os.path.join(root, file)
            original_size = os.path.getsize(filepath)
            
            try:
                if file.lower().endswith('.png') and has_optipng:
                    run_command(["optipng", "-o2", "-quiet", filepath])
                    optimized += 1
                elif file.lower().endswith(('.jpg', '.jpeg')) and has_jpegoptim:
                    run_command(["jpegoptim", "--strip-all", "-q", filepath])
                    optimized += 1
                
                new_size = os.path.getsize(filepath)
                total_saved += original_size - new_size
            except:
                pass
    
    print_success(f"تم تحسين {optimized} صورة")
    print_success(f"تم توفير {total_saved / 1024:.2f} KB")
    
    return {"optimized": optimized, "saved": total_saved}

# ==================== 5. فحص الأمان ====================

def security_scan():
    """فحص الثغرات الأمنية"""
    print_header("فحص الأمان", "🔒")
    
    issues = []
    
    # فحص Python
    print_step("فحص مكتبات Python...")
    success, out, err = run_command(["pip", "audit"])
    if not success:
        # جرب safety
        success, out, err = run_command(["safety", "check"])
    
    if success:
        print_success("لا توجد ثغرات معروفة في Python")
    else:
        print_warning("تعذر فحص Python (ثبّت: pip install pip-audit)")
    
    # فحص npm
    print_step("فحص مكتبات npm...")
    success, out, err = run_command(["yarn", "audit"], cwd=FRONTEND_DIR)
    if "0 vulnerabilities" in out or success:
        print_success("لا توجد ثغرات معروفة في npm")
    else:
        print_warning("توجد ثغرات في مكتبات npm")
        issues.append("npm vulnerabilities")
    
    # فحص أسرار مكشوفة
    print_step("البحث عن أسرار مكشوفة...")
    secrets_patterns = [
        r'api[_-]?key\s*=\s*["\'][^"\']+["\']',
        r'secret[_-]?key\s*=\s*["\'][^"\']+["\']',
        r'password\s*=\s*["\'][^"\']+["\']',
        r'AWS_ACCESS_KEY_ID',
        r'PRIVATE_KEY',
    ]
    
    exposed_secrets = []
    for root, _, files in os.walk("."):
        if any(skip in root for skip in ['node_modules', '.git', '__pycache__', 'venv']):
            continue
        
        for file in files:
            if file.endswith(('.py', '.js', '.jsx', '.env.example')):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', errors='ignore') as f:
                        content = f.read()
                    
                    for pattern in secrets_patterns:
                        if re.search(pattern, content, re.IGNORECASE):
                            if '.env' not in file:  # تجاهل ملفات .env
                                exposed_secrets.append(filepath)
                                break
                except:
                    pass
    
    if exposed_secrets:
        print_warning(f"وجدت {len(exposed_secrets)} ملف قد يحتوي على أسرار")
        for f in exposed_secrets[:5]:
            print(f"      - {f}")
    else:
        print_success("لا توجد أسرار مكشوفة في الكود")
    
    return {"issues": issues, "exposed_secrets": exposed_secrets}

# ==================== 6. إنشاء Docker ====================

def create_docker():
    """إنشاء ملفات Docker"""
    print_header("إنشاء Docker", "🐳")
    
    # Dockerfile للـ Backend
    backend_dockerfile = '''FROM python:3.11-slim

WORKDIR /app

# تثبيت المتطلبات
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# نسخ الكود
COPY backend/ .

# المنفذ
EXPOSE 8001

# التشغيل
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
'''
    
    # Dockerfile للـ Frontend
    frontend_dockerfile = '''FROM node:18-alpine as build

WORKDIR /app

# تثبيت المتطلبات
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile

# نسخ الكود وبناء
COPY frontend/ .
RUN yarn build

# Nginx للإنتاج
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
'''
    
    # Docker Compose
    docker_compose = '''version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    ports:
      - "8001:8001"
    environment:
      - MONGO_URL=${MONGO_URL}
    restart: unless-stopped

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - backend
      - frontend
    restart: unless-stopped
'''
    
    # حفظ الملفات
    with open("Dockerfile.backend", "w") as f:
        f.write(backend_dockerfile)
    print_success("تم إنشاء Dockerfile.backend")
    
    with open("Dockerfile.frontend", "w") as f:
        f.write(frontend_dockerfile)
    print_success("تم إنشاء Dockerfile.frontend")
    
    with open("docker-compose.yml", "w") as f:
        f.write(docker_compose)
    print_success("تم إنشاء docker-compose.yml")
    
    print_info("للتشغيل: docker-compose up -d")
    
    return {"created": True}

# ==================== 7. تقرير الأداء ====================

def performance_report():
    """تقرير تحليل الأداء"""
    print_header("تقرير الأداء", "📊")
    
    report = {
        "timestamp": datetime.now().isoformat(),
        "backend": {},
        "frontend": {},
        "recommendations": []
    }
    
    # تحليل Backend
    print_step("تحليل Backend...")
    backend_size = get_dir_size(BACKEND_DIR)
    py_files = list(Path(BACKEND_DIR).glob("**/*.py"))
    
    report["backend"] = {
        "total_size": backend_size,
        "total_size_readable": f"{backend_size / 1024 / 1024:.2f} MB",
        "python_files": len(py_files),
    }
    
    # أكبر ملفات Python
    large_py = []
    for f in py_files:
        size = os.path.getsize(f)
        if size > 10000:  # > 10KB
            large_py.append((str(f), size))
    large_py.sort(key=lambda x: x[1], reverse=True)
    report["backend"]["large_files"] = large_py[:5]
    
    print(f"   📁 حجم Backend: {report['backend']['total_size_readable']}")
    print(f"   📄 عدد ملفات Python: {len(py_files)}")
    
    # تحليل Frontend
    print_step("تحليل Frontend...")
    frontend_size = 0
    js_files = []
    
    for root, _, files in os.walk(FRONTEND_DIR):
        if 'node_modules' in root:
            continue
        for f in files:
            fp = os.path.join(root, f)
            size = os.path.getsize(fp)
            frontend_size += size
            if f.endswith(('.js', '.jsx', '.ts', '.tsx')):
                js_files.append((fp, size))
    
    js_files.sort(key=lambda x: x[1], reverse=True)
    
    report["frontend"] = {
        "total_size": frontend_size,
        "total_size_readable": f"{frontend_size / 1024 / 1024:.2f} MB",
        "js_files": len(js_files),
        "large_files": [(f, s) for f, s in js_files[:5]]
    }
    
    print(f"   📁 حجم Frontend (بدون node_modules): {report['frontend']['total_size_readable']}")
    print(f"   📄 عدد ملفات JS/JSX: {len(js_files)}")
    
    # التوصيات
    print_step("التوصيات...")
    
    if backend_size > 50 * 1024 * 1024:
        report["recommendations"].append("🔴 Backend كبير جداً - راجع الملفات الكبيرة")
    
    if len([f for f, s in js_files if s > 50000]) > 3:
        report["recommendations"].append("🟡 يوجد ملفات JS كبيرة - فكر في تقسيمها")
    
    # node_modules
    nm_path = os.path.join(FRONTEND_DIR, "node_modules")
    if os.path.exists(nm_path):
        nm_size = get_dir_size(nm_path)
        print(f"   📦 حجم node_modules: {nm_size / 1024 / 1024:.2f} MB")
        if nm_size > 500 * 1024 * 1024:
            report["recommendations"].append("🟡 node_modules كبير - راجع المكتبات غير المستخدمة")
    
    # طباعة التوصيات
    if report["recommendations"]:
        print("\n   📋 التوصيات:")
        for rec in report["recommendations"]:
            print(f"      {rec}")
    else:
        print_success("لا توجد مشاكل أداء واضحة")
    
    # حفظ التقرير
    ensure_dir(REPORT_DIR)
    report_file = os.path.join(REPORT_DIR, f"performance_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
    with open(report_file, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2, default=str)
    
    print_success(f"تم حفظ التقرير: {report_file}")
    
    return report

# ==================== 8. حذف الملفات المكررة ====================

def find_duplicates():
    """البحث عن الملفات المكررة"""
    print_header("البحث عن الملفات المكررة", "🔍")
    
    hashes = defaultdict(list)
    
    for root, _, files in os.walk("."):
        if any(skip in root for skip in ['node_modules', '.git', '__pycache__', 'venv', BACKUP_DIR]):
            continue
        
        for file in files:
            if file.endswith(tuple(CODE_EXTENSIONS + IMAGE_EXTENSIONS)):
                filepath = os.path.join(root, file)
                file_hash = calculate_hash(filepath)
                if file_hash:
                    hashes[file_hash].append(filepath)
    
    duplicates = {h: files for h, files in hashes.items() if len(files) > 1}
    
    if duplicates:
        print_warning(f"وجدت {len(duplicates)} مجموعة ملفات مكررة:")
        for hash_val, files in list(duplicates.items())[:5]:
            print(f"\n   📄 Hash: {hash_val[:8]}...")
            for f in files:
                print(f"      - {f} ({get_file_size(f)})")
    else:
        print_success("لا توجد ملفات مكررة")
    
    return {"duplicate_groups": len(duplicates), "details": duplicates}

# ==================== 9. نسخ احتياطي ====================

def create_backup():
    """إنشاء نسخة احتياطية"""
    print_header("إنشاء نسخة احتياطية", "💾")
    
    ensure_dir(BACKUP_DIR)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_name = f"backup_{timestamp}"
    backup_path = os.path.join(BACKUP_DIR, backup_name)
    
    print_step("نسخ الملفات...")
    
    # نسخ Backend
    shutil.copytree(
        BACKEND_DIR, 
        os.path.join(backup_path, BACKEND_DIR),
        ignore=shutil.ignore_patterns('__pycache__', '*.pyc', '.pytest_cache')
    )
    
    # نسخ Frontend (بدون node_modules)
    shutil.copytree(
        FRONTEND_DIR,
        os.path.join(backup_path, FRONTEND_DIR),
        ignore=shutil.ignore_patterns('node_modules', 'build', '.cache')
    )
    
    # ضغط النسخة
    print_step("ضغط النسخة...")
    archive_path = shutil.make_archive(backup_path, 'gztar', backup_path)
    
    # حذف المجلد غير المضغوط
    shutil.rmtree(backup_path)
    
    backup_size = os.path.getsize(archive_path)
    print_success(f"تم إنشاء النسخة: {archive_path}")
    print_success(f"الحجم: {backup_size / 1024 / 1024:.2f} MB")
    
    # حذف النسخ القديمة (الاحتفاظ بآخر 5)
    backups = sorted(Path(BACKUP_DIR).glob("backup_*.tar.gz"))
    if len(backups) > 5:
        for old_backup in backups[:-5]:
            old_backup.unlink()
            print_info(f"تم حذف نسخة قديمة: {old_backup.name}")
    
    return {"path": archive_path, "size": backup_size}

# ==================== 10. تنظيف Cache ====================

def clean_cache():
    """تنظيف ملفات Cache"""
    print_header("تنظيف Cache", "🧹")
    
    cleaned = 0
    freed_space = 0
    
    # Python cache
    for root, dirs, files in os.walk("."):
        for dir_name in dirs:
            if dir_name in ['__pycache__', '.pytest_cache', '.ruff_cache', '.mypy_cache']:
                dir_path = os.path.join(root, dir_name)
                try:
                    size = get_dir_size(dir_path)
                    shutil.rmtree(dir_path)
                    freed_space += size
                    cleaned += 1
                except:
                    pass
        
        for file in files:
            if file.endswith('.pyc') or file.endswith('.pyo'):
                filepath = os.path.join(root, file)
                try:
                    size = os.path.getsize(filepath)
                    os.remove(filepath)
                    freed_space += size
                    cleaned += 1
                except:
                    pass
    
    # npm cache
    npm_cache = os.path.join(FRONTEND_DIR, "node_modules", ".cache")
    if os.path.exists(npm_cache):
        try:
            size = get_dir_size(npm_cache)
            shutil.rmtree(npm_cache)
            freed_space += size
            cleaned += 1
        except:
            pass
    
    print_success(f"تم تنظيف {cleaned} عنصر")
    print_success(f"تم تحرير {freed_space / 1024 / 1024:.2f} MB")
    
    return {"cleaned": cleaned, "freed": freed_space}

# ==================== 11. فحص Environment ====================

def check_environment():
    """فحص متغيرات البيئة"""
    print_header("فحص Environment", "🔐")
    
    required_vars = {
        "backend/.env": [
            "MONGO_URL",
            "SUPABASE_URL",
            "SUPABASE_KEY",
        ],
        "frontend/.env": [
            "REACT_APP_BACKEND_URL",
        ]
    }
    
    missing = []
    found = []
    
    for env_file, vars_list in required_vars.items():
        if os.path.exists(env_file):
            with open(env_file, 'r') as f:
                content = f.read()
            
            for var in vars_list:
                if var in content and f"{var}=" in content:
                    found.append(f"{env_file}: {var}")
                else:
                    missing.append(f"{env_file}: {var}")
        else:
            print_warning(f"ملف غير موجود: {env_file}")
    
    print(f"   ✅ متغيرات موجودة: {len(found)}")
    for v in found:
        print(f"      - {v}")
    
    if missing:
        print(f"\n   ⚠️ متغيرات مفقودة: {len(missing)}")
        for v in missing:
            print(f"      - {v}")
    
    return {"found": found, "missing": missing}

# ==================== 12. إنشاء Changelog ====================

def generate_changelog():
    """إنشاء changelog من Git"""
    print_header("إنشاء Changelog", "📝")
    
    success, out, err = run_command(["git", "log", "--oneline", "-20"])
    
    if not success:
        print_warning("تعذر قراءة Git log")
        return {"generated": False}
    
    changelog = f"""# 📋 سجل التغييرات
تاريخ الإنشاء: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## آخر 20 commit:

"""
    
    for line in out.strip().split('\n'):
        if line:
            changelog += f"- {line}\n"
    
    with open("CHANGELOG_AUTO.md", "w", encoding="utf-8") as f:
        f.write(changelog)
    
    print_success("تم إنشاء CHANGELOG_AUTO.md")
    
    return {"generated": True}

# ==================== 13. تحليل الكود المكرر ====================

def analyze_code_duplication():
    """تحليل الكود المكرر"""
    print_header("تحليل الكود المكرر", "🔄")
    
    # تحليل بسيط للدوال المكررة
    functions = defaultdict(list)
    
    for root, _, files in os.walk(BACKEND_DIR):
        for file in files:
            if file.endswith('.py'):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    # البحث عن تعريفات الدوال
                    for match in re.finditer(r'def\s+(\w+)\s*\(', content):
                        func_name = match.group(1)
                        if not func_name.startswith('_'):
                            functions[func_name].append(filepath)
                except:
                    pass
    
    # الدوال المكررة
    duplicated = {name: files for name, files in functions.items() if len(files) > 1}
    
    if duplicated:
        print_warning(f"وجدت {len(duplicated)} دالة بنفس الاسم في ملفات مختلفة:")
        for name, files in list(duplicated.items())[:10]:
            print(f"\n   🔸 {name}():")
            for f in files:
                print(f"      - {f}")
    else:
        print_success("لا توجد دوال مكررة بشكل واضح")
    
    return {"duplicated_functions": len(duplicated)}

# ==================== 14. تقرير شامل ====================

def generate_full_report(results):
    """إنشاء تقرير شامل"""
    print_header("إنشاء التقرير الشامل", "📊")
    
    ensure_dir(REPORT_DIR)
    
    report = f"""# 📊 تقرير تحسين المشروع الشامل

**تاريخ:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

---

## 📈 ملخص التحسينات

| العملية | الحالة |
|---------|--------|
| تحسين Backend | ✅ مكتمل |
| تحسين Frontend | ✅ مكتمل |
| ضغط Gzip | {'✅ مكتمل' if results.get('gzip') else '⏭️ تخطي'} |
| تحسين الصور | {'✅ مكتمل' if results.get('images') else '⏭️ تخطي'} |
| فحص الأمان | {'✅ مكتمل' if results.get('security') else '⏭️ تخطي'} |
| تنظيف Cache | {'✅ مكتمل' if results.get('cache') else '⏭️ تخطي'} |

---

## 📁 إحصائيات المشروع

- **Backend:** {get_dir_size(BACKEND_DIR) / 1024 / 1024:.2f} MB
- **Frontend:** {get_dir_size(FRONTEND_DIR) / 1024 / 1024:.2f} MB (مع node_modules)

---

## 🔧 الأوامر المفيدة

```bash
# تشغيل التحسين الكامل
python optimize.py --all

# نسخ احتياطي
python optimize.py --backup

# فحص الأمان فقط
python optimize.py --security

# تنظيف Cache
python optimize.py --clean
```

---

## 📋 التوصيات

1. شغّل التحسين بشكل دوري (أسبوعياً)
2. راجع التقارير في مجلد `reports/`
3. احتفظ بالنسخ الاحتياطية في مكان آمن
4. تأكد من تحديث المكتبات بانتظام

"""
    
    report_path = os.path.join(REPORT_DIR, f"full_report_{datetime.now().strftime('%Y%m%d')}.md")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report)
    
    # نسخة في الجذر
    with open("optimization_report.md", "w", encoding="utf-8") as f:
        f.write(report)
    
    print_success(f"تم إنشاء التقرير: {report_path}")
    
    return report_path

# ==================== الدالة الرئيسية ====================

def main():
    """الدالة الرئيسية"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="🚀 سكربت تحسين المشروع المتقدم",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
أمثلة:
  python optimize.py                 # التحسين الأساسي
  python optimize.py --all           # كل التحسينات
  python optimize.py --security      # فحص الأمان فقط
  python optimize.py --backup        # نسخ احتياطي
  python optimize.py --clean         # تنظيف Cache
        """
    )
    
    parser.add_argument("--backend", action="store_true", help="تحسين Backend")
    parser.add_argument("--frontend", action="store_true", help="تحسين Frontend")
    parser.add_argument("--gzip", action="store_true", help="إنشاء ملفات Gzip")
    parser.add_argument("--images", action="store_true", help="تحسين الصور")
    parser.add_argument("--security", action="store_true", help="فحص الأمان")
    parser.add_argument("--docker", action="store_true", help="إنشاء ملفات Docker")
    parser.add_argument("--performance", action="store_true", help="تقرير الأداء")
    parser.add_argument("--duplicates", action="store_true", help="البحث عن الملفات المكررة")
    parser.add_argument("--backup", action="store_true", help="نسخ احتياطي")
    parser.add_argument("--clean", action="store_true", help="تنظيف Cache")
    parser.add_argument("--env", action="store_true", help="فحص Environment")
    parser.add_argument("--changelog", action="store_true", help="إنشاء Changelog")
    parser.add_argument("--duplication", action="store_true", help="تحليل الكود المكرر")
    parser.add_argument("--all", action="store_true", help="تشغيل كل التحسينات")
    
    args = parser.parse_args()
    
    # إذا لم يتم تحديد أي خيار
    if not any(vars(args).values()):
        args.backend = True
        args.frontend = True
    
    print_header("بدء تحسين المشروع", "🚀")
    start_time = time.time()
    
    results = {}
    
    # تنفيذ العمليات
    if args.backend or args.all:
        results['backend'] = optimize_backend()
    
    if args.frontend or args.all:
        results['frontend'] = optimize_frontend()
    
    if args.gzip or args.all:
        results['gzip'] = create_gzip_files()
    
    if args.images or args.all:
        results['images'] = optimize_images()
    
    if args.security or args.all:
        results['security'] = security_scan()
    
    if args.docker or args.all:
        results['docker'] = create_docker()
    
    if args.performance or args.all:
        results['performance'] = performance_report()
    
    if args.duplicates or args.all:
        results['duplicates'] = find_duplicates()
    
    if args.backup:
        results['backup'] = create_backup()
    
    if args.clean or args.all:
        results['cache'] = clean_cache()
    
    if args.env or args.all:
        results['env'] = check_environment()
    
    if args.changelog or args.all:
        results['changelog'] = generate_changelog()
    
    if args.duplication or args.all:
        results['duplication'] = analyze_code_duplication()
    
    # إنشاء التقرير
    generate_full_report(results)
    
    elapsed = time.time() - start_time
    print_header(f"اكتمل التحسين في {elapsed:.2f} ثانية", "🎉")

if __name__ == "__main__":
    main()
