#!/usr/bin/env python3
import os
import re

TEMPLATE_FILE = 'README.template.md'
OUTPUT_FILE = 'README.md'

def read_file(filepath):
    """Reads the contents of a file safely."""
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    return f"<!-- Error: File '{filepath}' not found -->"

def inject_content(match):
    """Parses the injection command and returns the replacement text."""
    command = match.group(1).strip()
    
    # Example: <!-- INJECT: INCLUDE: docs/features.md -->
    if command.startswith("INCLUDE:"):
        filename = command.split("INCLUDE:")[1].strip()
        print(f"📥 Injecting content from: {filename}")
        return read_file(filename)
        
    # Example: <!-- INJECT: VERSION -->
    elif command == "VERSION":
        print("📥 Injecting version number")
        return read_file("VERSION").strip()
    
    return match.group(0) # Return original tag if command is unrecognized

def generate_readme():
    print("🚀 Starting README generation...")
    if not os.path.exists(TEMPLATE_FILE):
        print(f"❌ Error: Template file '{TEMPLATE_FILE}' not found.")
        return

    with open(TEMPLATE_FILE, 'r', encoding='utf-8') as f:
        template_content = f.read()

    # Match HTML comment injection tags
    pattern = re.compile(r'<!--\s*INJECT:\s*(.*?)\s*-->')
    output_content = pattern.sub(inject_content, template_content)

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(output_content)

    print(f"✅ Successfully generated {OUTPUT_FILE}")

if __name__ == "__main__":
    generate_readme()