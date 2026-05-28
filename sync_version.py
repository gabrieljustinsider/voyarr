#!/usr/bin/env python3
import os
import re
import json
import subprocess

def main():
    # 1. Read single source of truth
    root_dir = os.path.dirname(os.path.abspath(__file__))
    version_file_path = os.path.join(root_dir, "VERSION")
    
    if not os.path.exists(version_file_path):
        print(f"Error: {version_file_path} not found.")
        return

    with open(version_file_path, "r") as f:
        version = f.read().strip()
        
    if not version:
        print("Error: VERSION file is empty.")
        return

    print(f"Syncing all version references to source of truth: {version}")

    # 2. Update root package.json
    root_pkg_path = os.path.join(root_dir, "package.json")
    if os.path.exists(root_pkg_path):
        with open(root_pkg_path, "r") as f:
            pkg = json.load(f)
        pkg["version"] = version
        with open(root_pkg_path, "w") as f:
            json.dump(pkg, f, indent=2)
            f.write("\n")
        print(f"Updated {root_pkg_path}")

    # 3. Update frontend/package.json
    frontend_pkg_path = os.path.join(root_dir, "frontend", "package.json")
    if os.path.exists(frontend_pkg_path):
        with open(frontend_pkg_path, "r") as f:
            pkg = json.load(f)
        pkg["version"] = version
        with open(frontend_pkg_path, "w") as f:
            json.dump(pkg, f, indent=2)
            f.write("\n")
        print(f"Updated {frontend_pkg_path}")

    # 4. Update extension/manifest.json
    ext_manifest_path = os.path.join(root_dir, "extension", "manifest.json")
    if os.path.exists(ext_manifest_path):
        with open(ext_manifest_path, "r") as f:
            manifest = json.load(f)
        manifest["version"] = version
        with open(ext_manifest_path, "w") as f:
            json.dump(manifest, f, indent=2)
            f.write("\n")
        print(f"Updated {ext_manifest_path}")

    # 5. Update backend/main.py FastAPI instantiation version
    backend_main_path = os.path.join(root_dir, "backend", "main.py")
    if os.path.exists(backend_main_path):
        with open(backend_main_path, "r") as f:
            content = f.read()
        
        # Match app = FastAPI(..., version="...")
        pattern = r'(app\s*=\s*FastAPI\([^)]*version\s*=\s*")[^"]*(")'
        new_content, count = re.subn(pattern, rf'\g<1>{version}\g<2>', content)
        
        if count > 0:
            with open(backend_main_path, "w") as f:
                f.write(new_content)
            print(f"Updated {backend_main_path}")
        else:
            print(f"Warning: Could not find version parameter in FastAPI instantiation in {backend_main_path}")

    # 5b. Update backend/Dockerfile and frontend/Dockerfile version LABELs
    dockerfiles = [
        os.path.join(root_dir, "backend", "Dockerfile"),
        os.path.join(root_dir, "frontend", "Dockerfile")
    ]
    for df_path in dockerfiles:
        if os.path.exists(df_path):
            with open(df_path, "r") as f:
                content = f.read()
            
            # Match LABEL version="..."
            pattern_ver = r'(LABEL\s+version\s*=\s*")[^"]*(")'
            content, count1 = re.subn(pattern_ver, rf'\g<1>{version}\g<2>', content)
            
            # Match LABEL org.opencontainers.image.version="..."
            pattern_oci = r'(LABEL\s+org\.opencontainers\.image\.version\s*=\s*")[^"]*(")'
            content, count2 = re.subn(pattern_oci, rf'\g<1>{version}\g<2>', content)
            
            if count1 > 0 or count2 > 0:
                with open(df_path, "w") as f:
                    f.write(content)
                print(f"Updated {df_path}")
            else:
                # If labels are not found, let's append them under the base image
                # In backend Dockerfile, append after line 1: FROM python:...
                # In frontend Dockerfile, append after line 22: FROM nginx:alpine
                lines = content.splitlines(keepends=True)
                new_lines = []
                for line in lines:
                    new_lines.append(line)
                    if line.startswith("FROM python:") or line.startswith("FROM nginx:"):
                        new_lines.append(f'LABEL version="{version}"\n')
                        new_lines.append(f'LABEL org.opencontainers.image.version="{version}"\n')
                
                with open(df_path, "w") as f:
                    f.writelines(new_lines)
                print(f"Added version LABELs to {df_path}")

    # 6. Update package-lock.json files
    print("Regenerating package-lock.json files to sync locks...")
    try:
        subprocess.run(["npm", "install", "--package-lock-only"], cwd=root_dir, check=True)
        print("Root package-lock.json updated successfully.")
    except Exception as e:
        print(f"Warning: Failed to update root package-lock.json: {e}")

    try:
        subprocess.run(["npm", "install", "--package-lock-only"], cwd=os.path.join(root_dir, "frontend"), check=True)
        print("Frontend package-lock.json updated successfully.")
    except Exception as e:
        print(f"Warning: Failed to update frontend package-lock.json: {e}")

    print("Version synchronization completed successfully!")

if __name__ == "__main__":
    main()
