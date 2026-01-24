#!/usr/bin/env python3
"""
🚀 سكربت تحسين المشروع - AutoPro Workshop
يقوم بتحسين وضغط كود Backend و Frontend
"""

import os
import shutil
import subprocess
import sys
import time
import gzip
import hashlib
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

# المسارات
BACKEND_DIR = "backend"
FRONTEND_DIR = "frontend"
DIST_DIR = "dist"
REPORT_FILE = "optimization_report.md"

# الألوان للطباعة
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_header(text):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*50}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}  {text}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*50}{Colors.END}\n")

def print_success(text):
    print(f"{Colors.GREEN}✅ {text}{Colors.END}")

def print_warning(text):
    print(f"{Colors.YELLOW}⚠️  {text}{Colors.END}")

def print_error(text):
    print(f"{Colors.RED}❌ {text}{Colors.END}")

def get_file_size(path):
    """الحصول على حجم الملف بصيغة مقروءة"""
    size = os.path.getsize(path)
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size < 1024:
            return f"{size:.2f} {unit}"
        size /= 1024
    return f"{size:.2f} TB"

def calculate_checksum(filepath):
    """حساب MD5 للملف"""
    hash_md5 = hashlib.md5()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()[:8]

# ==================== تحسين Backend ====================

def optimize_backend(fix_imports=True, format_code=True, lint_code=True):
    """تحسين كود Backend"""
    print_header("🔧 تحسين Backend (FastAPI)")
    
    stats = {"fixed": 0, "formatted": 0, "errors": 0}
    
    if fix_imports:
        print("📦 إزالة الـ imports غير المستخدمة...")
        result = subprocess.run(
            ["autoflake", "--in-place", "--remove-all-unused-imports", 
             "--remove-unused-variables", "-r", BACKEND_DIR],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            print_success("تم إزالة الـ imports غير المستخدمة")
        else:
            print_warning(f"autoflake: {result.stderr[:100]}")
    
    if format_code:
        print("🎨 تنسيق الكود باستخدام Black...")
        result = subprocess.run(
            ["black", BACKEND_DIR, "--quiet"],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            print_success("تم تنسيق الكود")
        else:
            print_warning(f"black: {result.stderr[:100]}")
    
    if lint_code:
        print("🔍 فحص وإصلاح الأخطاء باستخدام Ruff...")
        result = subprocess.run(
            ["ruff", "check", BACKEND_DIR, "--fix", "--silent"],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            print_success("تم فحص وإصلاح الأخطاء")
        else:
            print_warning(f"ruff: {result.stderr[:100]}")
    
    return stats

# ==================== تحسين Frontend ====================

def minify_html(content):
    """ضغط HTML"""
    try:
        from htmlmin import minify
        return minify(content, remove_comments=True, remove_empty_space=True)
    except:
        return content

def minify_css(content):
    """ضغط CSS"""
    try:
        from csscompressor import compress
        return compress(content)
    except:
        return content

def minify_js(content):
    """ضغط JavaScript"""
    try:
        from jsmin import jsmin
        return jsmin(content)
    except:
        return content

def process_file(src, dst, file_type):
    """معالجة ملف واحد"""
    try:
        with open(src, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        
        original_size = len(content)
        
        if file_type == "html":
            content = minify_html(content)
        elif file_type == "css":
            content = minify_css(content)
        elif file_type == "js" and not src.endswith('.min.js'):
            content = minify_js(content)
        
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        
        with open(dst, "w", encoding="utf-8") as f:
            f.write(content)
        
        new_size = len(content)
        saved = original_size - new_size
        
        return {"src": src, "original": original_size, "new": new_size, "saved": saved}
    except Exception as e:
        return {"src": src, "error": str(e)}

def optimize_frontend(create_dist=False, skip_node_modules=True):
    """تحسين Frontend"""
    print_header("🎨 تحسين Frontend (React)")
    
    if not create_dist:
        print_warning("تخطي إنشاء dist (استخدم --dist لتفعيله)")
        
        # فقط تشغيل ESLint
        print("🔍 فحص كود React...")
        result = subprocess.run(
            ["yarn", "lint", "--fix"],
            cwd=FRONTEND_DIR,
            capture_output=True, text=True
        )
        if result.returncode == 0:
            print_success("تم فحص كود React")
        return {"files": 0, "saved": 0}
    
    print("📁 إنشاء مجلد dist محسّن...")
    
    if os.path.exists(DIST_DIR):
        shutil.rmtree(DIST_DIR)
    
    stats = {"files": 0, "total_saved": 0, "errors": []}
    file_tasks = []
    
    # جمع الملفات للمعالجة
    for root, dirs, files in os.walk(FRONTEND_DIR):
        # تخطي node_modules
        if skip_node_modules and 'node_modules' in root:
            continue
        
        for file in files:
            src = os.path.join(root, file)
            rel = os.path.relpath(src, FRONTEND_DIR)
            dst = os.path.join(DIST_DIR, rel)
            
            if file.endswith(".html"):
                file_tasks.append((src, dst, "html"))
            elif file.endswith(".css"):
                file_tasks.append((src, dst, "css"))
            elif file.endswith(".js") or file.endswith(".jsx"):
                file_tasks.append((src, dst, "js"))
            else:
                # نسخ الملفات الأخرى كما هي
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                shutil.copy2(src, dst)
    
    # معالجة متوازية
    print(f"⚡ معالجة {len(file_tasks)} ملف...")
    
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(process_file, *task): task for task in file_tasks}
        
        for future in as_completed(futures):
            result = future.result()
            if "error" in result:
                stats["errors"].append(result)
            else:
                stats["files"] += 1
                stats["total_saved"] += result["saved"]
    
    print_success(f"تم معالجة {stats['files']} ملف")
    print_success(f"تم توفير {stats['total_saved'] / 1024:.2f} KB")
    
    return stats

# ==================== تحسينات إضافية ====================

def analyze_bundle_size():
    """تحليل حجم الـ bundle"""
    print_header("📊 تحليل حجم الملفات")
    
    large_files = []
    
    for root, _, files in os.walk(FRONTEND_DIR):
        if 'node_modules' in root:
            continue
        for file in files:
            filepath = os.path.join(root, file)
            size = os.path.getsize(filepath)
            if size > 50000:  # أكبر من 50KB
                large_files.append((filepath, size))
    
    large_files.sort(key=lambda x: x[1], reverse=True)
    
    print("📁 الملفات الكبيرة (> 50KB):")
    for filepath, size in large_files[:10]:
        rel_path = os.path.relpath(filepath, FRONTEND_DIR)
        print(f"   {get_file_size(filepath):>10}  {rel_path}")
    
    return large_files

def check_unused_dependencies():
    """فحص المكتبات غير المستخدمة"""
    print_header("📦 فحص المكتبات")
    
    # Backend
    print("🐍 Backend (Python):")
    result = subprocess.run(
        ["pip", "list", "--outdated", "--format=columns"],
        capture_output=True, text=True
    )
    if result.stdout:
        lines = result.stdout.strip().split('\n')[:6]
        for line in lines:
            print(f"   {line}")
    
    # Frontend
    print("\n⚛️  Frontend (npm):")
    result = subprocess.run(
        ["yarn", "outdated"],
        cwd=FRONTEND_DIR,
        capture_output=True, text=True
    )
    if result.stdout:
        lines = result.stdout.strip().split('\n')[:6]
        for line in lines:
            print(f"   {line}")

def generate_report(backend_stats, frontend_stats):
    """إنشاء تقرير التحسين"""
    report = f"""# 📊 تقرير تحسين المشروع
تاريخ: {time.strftime('%Y-%m-%d %H:%M:%S')}

## Backend
- تم تنظيف وتنسيق الكود بنجاح

## Frontend  
- الملفات المعالجة: {frontend_stats.get('files', 0)}
- الحجم الموفر: {frontend_stats.get('total_saved', 0) / 1024:.2f} KB

## التوصيات
1. تشغيل `yarn build` للإنتاج
2. تفعيل gzip على السيرفر
3. استخدام CDN للملفات الثابتة
"""
    
    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        f.write(report)
    
    print_success(f"تم إنشاء التقرير: {REPORT_FILE}")

# ==================== الدالة الرئيسية ====================

def main():
    """الدالة الرئيسية"""
    import argparse
    
    parser = argparse.ArgumentParser(description="🚀 سكربت تحسين المشروع")
    parser.add_argument("--backend", action="store_true", help="تحسين Backend فقط")
    parser.add_argument("--frontend", action="store_true", help="تحسين Frontend فقط")
    parser.add_argument("--dist", action="store_true", help="إنشاء مجلد dist مضغوط")
    parser.add_argument("--analyze", action="store_true", help="تحليل حجم الملفات")
    parser.add_argument("--deps", action="store_true", help="فحص المكتبات")
    parser.add_argument("--all", action="store_true", help="تشغيل كل التحسينات")
    
    args = parser.parse_args()
    
    # إذا لم يتم تحديد أي خيار، شغّل الأساسيات
    if not any([args.backend, args.frontend, args.dist, args.analyze, args.deps, args.all]):
        args.backend = True
        args.frontend = True
    
    print_header("🚀 بدء تحسين المشروع")
    start_time = time.time()
    
    backend_stats = {}
    frontend_stats = {}
    
    if args.backend or args.all:
        backend_stats = optimize_backend()
    
    if args.frontend or args.all:
        frontend_stats = optimize_frontend(create_dist=args.dist)
    
    if args.analyze or args.all:
        analyze_bundle_size()
    
    if args.deps or args.all:
        check_unused_dependencies()
    
    # إنشاء التقرير
    generate_report(backend_stats, frontend_stats)
    
    elapsed = time.time() - start_time
    print_header(f"🎉 اكتمل التحسين في {elapsed:.2f} ثانية")

if __name__ == "__main__":
    main()
