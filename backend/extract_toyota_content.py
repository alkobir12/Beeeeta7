#!/usr/bin/env python3
"""
Toyota Manual Content Parser
Extracts content from HTML files and converts to modern format
"""
import json
import re
from pathlib import Path
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor

MANUALS_DIR = Path("/app/backend/static/manuals/lc200")
OUTPUT_DIR = Path("/app/backend/static/toyota_content")
OUTPUT_DIR.mkdir(exist_ok=True)


def parse_html_file(html_path):
    """Parse a single HTML file and extract content"""
    try:
        with open(html_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()

        soup = BeautifulSoup(content, "html.parser")

        # Extract title
        title = soup.find("title")
        title_text = title.get_text() if title else ""

        # Extract main content
        body = soup.find("body")
        if not body:
            return None

        # Extract text content
        text_content = body.get_text(separator="\n", strip=True)

        # Extract images
        images = []
        for img in soup.find_all("img"):
            src = img.get("src", "")
            if src:
                images.append(
                    {
                        "src": src,
                        "alt": img.get("alt", ""),
                        "path": (
                            str(html_path.parent / src)
                            if not src.startswith("http")
                            else src
                        ),
                    }
                )

        # Extract headers and sections
        sections = []
        for tag in ["h1", "h2", "h3", "h4"]:
            for header in soup.find_all(tag):
                sections.append({"level": tag, "text": header.get_text(strip=True)})

        # Extract links
        links = []
        for a in soup.find_all("a"):
            href = a.get("href", "")
            text = a.get_text(strip=True)
            if href and text:
                links.append({"href": href, "text": text})

        return {
            "file": str(html_path.relative_to(MANUALS_DIR)),
            "title": title_text,
            "content": text_content[:5000],  # First 5000 chars
            "images": images[:10],  # First 10 images
            "sections": sections[:20],  # First 20 sections
            "links": links[:30],  # First 30 links
            "has_more": len(text_content) > 5000,
        }
    except Exception as e:
        print(f"Error parsing {html_path}: {e}")
        return None


def extract_sections_structure():
    """Extract main sections from groups.html"""
    groups_file = MANUALS_DIR / "repair" / "groups.html"

    try:
        with open(groups_file, "r", encoding="utf-8") as f:
            content = f.read()

        soup = BeautifulSoup(content, "html.parser")
        sections = []

        for link in soup.find_all("a", class_=["menu", "sousetsu", "first"]):
            onclick = link.get("onclick", "")
            title = link.get("title", link.get_text(strip=True))

            # Extract menu ID from onclick
            menu_id = ""
            if "clickMenu" in onclick:
                match = re.search(r"clickMenu\('([^']+)'\)", onclick)
                if match:
                    menu_id = match.group(1)

            if title:
                sections.append(
                    {
                        "id": menu_id or f"sec_{len(sections)}",
                        "title": title,
                        "class": link.get("class", [""])[0],
                    }
                )

        return sections
    except Exception as e:
        print(f"Error extracting sections: {e}")
        return []


def process_batch(html_files, start_idx, batch_size):
    """Process a batch of HTML files"""
    batch = html_files[start_idx : start_idx + batch_size]
    results = []

    with ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(parse_html_file, batch))

    # Filter out None results
    results = [r for r in results if r is not None]
    return results


def main():
    print("🚀 Starting Toyota Manual Content Extraction")
    print(f"📂 Source: {MANUALS_DIR}")
    print(f"📁 Output: {OUTPUT_DIR}")

    # Extract sections structure
    print("\n1️⃣ Extracting sections structure...")
    sections = extract_sections_structure()
    print(f"   ✅ Found {len(sections)} sections")

    # Save sections
    with open(OUTPUT_DIR / "sections.json", "w", encoding="utf-8") as f:
        json.dump(sections, f, ensure_ascii=False, indent=2)

    # Find all HTML files
    print("\n2️⃣ Finding HTML files...")
    html_files = list(MANUALS_DIR.rglob("*.html"))
    print(f"   ✅ Found {len(html_files)} HTML files")

    # Process first batch (500 files for quick start)
    print("\n3️⃣ Processing first batch (500 files)...")
    batch_size = 500
    batch_results = process_batch(html_files, 0, batch_size)

    print(f"   ✅ Processed {len(batch_results)} files")

    # Save batch results
    with open(OUTPUT_DIR / "content_batch_1.json", "w", encoding="utf-8") as f:
        json.dump(batch_results, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Extraction complete!")
    print(f"📊 Stats:")
    print(f"   - Sections: {len(sections)}")
    print(f"   - Files processed: {len(batch_results)}")
    print(f"   - Total files: {len(html_files)}")
    print(
        f"   - Progress: {len(batch_results)}/{len(html_files)} ({100*len(batch_results)//len(html_files)}%)"
    )

    return {
        "sections": len(sections),
        "processed": len(batch_results),
        "total": len(html_files),
    }


if __name__ == "__main__":
    stats = main()
    print(f"\n📝 Next steps:")
    print(f"   1. Review extracted content in {OUTPUT_DIR}")
    print(f"   2. Build React components with Apple design")
    print(
        f"   3. Process remaining {stats['total'] - stats['processed']} files in background"
    )
