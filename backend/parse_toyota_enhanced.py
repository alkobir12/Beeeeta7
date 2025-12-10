#!/usr/bin/env python3
"""
Enhanced Toyota Manual Parser with Progress Tracking
Extracts content in batches for better performance
"""
import os
import json
import re
from pathlib import Path
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

MANUALS_DIR = Path('/app/backend/static/manuals/lc200')
OUTPUT_DIR = Path('/app/backend/static/toyota_content')
OUTPUT_DIR.mkdir(exist_ok=True)

# Arabic translations for sections
SECTION_TRANSLATIONS = {
    "READ ME": "اقرأني",
    "General": "معلومات عامة",
    "Engine / Hybrid System": "المحرك والهايبرد",
    "Drivetrain": "نظام الدفع",
    "Suspension": "التعليق",
    "Brake": "الفرامل",
    "Steering": "التوجيه",
    "Audio/Visual/Telematics": "الصوتيات والاتصالات",
    "Power Source / Network": "الطاقة والشبكات",
    "Vehicle Interior": "الداخلية",
    "Vehicle Exterior": "الخارجية"
}

SECTION_ICONS = {
    "READ ME": "📋",
    "General": "📖",
    "Engine / Hybrid System": "🔩",
    "Drivetrain": "⚙️",
    "Suspension": "🏗️",
    "Brake": "🛑",
    "Steering": "🎛️",
    "Audio/Visual/Telematics": "🎵",
    "Power Source / Network": "🔌",
    "Vehicle Interior": "🪟",
    "Vehicle Exterior": "🚘"
}

def clean_text(text):
    """Clean and normalize text"""
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text)
    # Remove special characters
    text = re.sub(r'[\x00-\x08\x0b-\x0c\x0e-\x1f]', '', text)
    return text.strip()

def parse_content_file(html_path):
    """Parse a content HTML file"""
    try:
        with open(html_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        soup = BeautifulSoup(content, 'lxml')
        
        # Extract main content
        data = {
            'file': str(html_path.relative_to(MANUALS_DIR)),
            'title': '',
            'content': [],
            'images': [],
            'procedures': []
        }
        
        # Get title
        title_tag = soup.find('title')
        if title_tag:
            data['title'] = clean_text(title_tag.get_text())
        
        # Extract h3 headers (main sections)
        for h3 in soup.find_all('h3'):
            section_text = clean_text(h3.get_text())
            if section_text:
                data['content'].append({
                    'type': 'heading',
                    'level': 3,
                    'text': section_text
                })
        
        # Extract ordered lists (procedures)
        for ol in soup.find_all('ol'):
            items = []
            for li in ol.find_all('li', recursive=False):
                item_text = clean_text(li.get_text())
                if item_text:
                    items.append(item_text)
            
            if items:
                data['procedures'].append({
                    'type': 'procedure',
                    'steps': items
                })
        
        # Extract paragraphs
        for p in soup.find_all('p'):
            p_text = clean_text(p.get_text())
            if p_text and len(p_text) > 10:
                data['content'].append({
                    'type': 'paragraph',
                    'text': p_text
                })
        
        # Extract images
        for img in soup.find_all('img'):
            src = img.get('src', '')
            if src and not src.startswith('http'):
                # Convert relative path to absolute
                img_path = html_path.parent / src
                if img_path.exists():
                    rel_path = str(img_path.relative_to(MANUALS_DIR))
                    data['images'].append({
                        'src': f'/api/manuals/lc200/{rel_path}',
                        'alt': img.get('alt', ''),
                        'title': img.get('title', '')
                    })
        
        # Only return if has meaningful content
        if data['content'] or data['procedures'] or data['images']:
            return data
        
        return None
        
    except Exception as e:
        return None

def process_batch_parallel(files, batch_name, max_workers=20):
    """Process files in parallel"""
    results = []
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_file = {executor.submit(parse_content_file, f): f for f in files}
        
        completed = 0
        for future in as_completed(future_to_file):
            completed += 1
            result = future.result()
            if result:
                results.append(result)
            
            if completed % 100 == 0:
                print(f"   Progress: {completed}/{len(files)} files ({100*completed//len(files)}%)")
    
    return results

def main():
    start_time = time.time()
    
    print("🚀 Enhanced Toyota Manual Extraction - Apple Design Ready")
    print("="*70)
    
    # Step 1: Extract sections
    print("\n1️⃣ Extracting sections structure...")
    groups_file = MANUALS_DIR / 'repair' / 'groups.html'
    
    with open(groups_file, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f.read(), 'lxml')
    
    sections = []
    for link in soup.find_all('a', class_=['menu', 'sousetsu', 'first']):
        title = link.get('title', link.get_text(strip=True))
        onclick = link.get('onclick', '')
        
        menu_id = ''
        if 'clickMenu' in onclick:
            match = re.search(r"clickMenu\('([^']+)'\)", onclick)
            if match:
                menu_id = match.group(1)
        
        if title:
            sections.append({
                'id': menu_id or f'sec_{len(sections)}',
                'title': title,
                'title_ar': SECTION_TRANSLATIONS.get(title, title),
                'icon': SECTION_ICONS.get(title, '📄'),
                'class': link.get('class', [''])[0]
            })
    
    print(f"   ✅ Extracted {len(sections)} sections")
    
    # Save sections
    with open(OUTPUT_DIR / 'sections.json', 'w', encoding='utf-8') as f:
        json.dump(sections, f, ensure_ascii=False, indent=2)
    
    # Step 2: Find content files
    print("\n2️⃣ Finding content files...")
    content_dir = MANUALS_DIR / 'repair2' / 'html' / 'contents'
    
    if content_dir.exists():
        html_files = list(content_dir.glob('*.html'))
        print(f"   ✅ Found {len(html_files)} content files")
    else:
        print("   ⚠️  Contents directory not found, searching all...")
        html_files = [f for f in MANUALS_DIR.rglob('*.html') 
                     if 'contents' in str(f) or 'preparation' in str(f)]
        print(f"   ✅ Found {len(html_files)} HTML files")
    
    # Step 3: Process in batches
    print("\n3️⃣ Processing content files...")
    batch_size = 1000
    all_content = []
    
    for i in range(0, min(3000, len(html_files)), batch_size):
        batch_files = html_files[i:i+batch_size]
        print(f"\n   Batch {i//batch_size + 1}: Processing {len(batch_files)} files...")
        
        batch_results = process_batch_parallel(batch_files, f"batch_{i//batch_size + 1}")
        all_content.extend(batch_results)
        
        print(f"   ✅ Extracted {len(batch_results)} valid documents")
        
        # Save batch
        with open(OUTPUT_DIR / f'content_batch_{i//batch_size + 1}.json', 'w', encoding='utf-8') as f:
            json.dump(batch_results, f, ensure_ascii=False, indent=2)
    
    # Step 4: Create index
    print("\n4️⃣ Creating search index...")
    index = []
    for doc in all_content:
        # Create searchable entry
        search_text = ' '.join([
            doc.get('title', ''),
            ' '.join([c.get('text', '') for c in doc.get('content', [])]),
            ' '.join([' '.join(p.get('steps', [])) for p in doc.get('procedures', [])])
        ])
        
        if search_text.strip():
            index.append({
                'file': doc['file'],
                'title': doc.get('title', ''),
                'preview': search_text[:200],
                'images_count': len(doc.get('images', [])),
                'has_procedures': len(doc.get('procedures', [])) > 0
            })
    
    with open(OUTPUT_DIR / 'search_index.json', 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
    
    # Final stats
    elapsed = time.time() - start_time
    
    print("\n" + "="*70)
    print("✅ EXTRACTION COMPLETE!")
    print("="*70)
    print(f"📊 Statistics:")
    print(f"   - Sections: {len(sections)}")
    print(f"   - Content files processed: {len(all_content)}")
    print(f"   - Search index entries: {len(index)}")
    print(f"   - Images found: {sum(len(d.get('images', [])) for d in all_content)}")
    print(f"   - Time taken: {elapsed:.1f} seconds ({elapsed/60:.1f} minutes)")
    print(f"\n📁 Output directory: {OUTPUT_DIR}")
    print(f"\n🎯 Ready for Apple Design UI!")

if __name__ == '__main__':
    main()
