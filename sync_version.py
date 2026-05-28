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

    # 5. Update backend/main.py VOYARR_VERSION constant
    backend_main_path = os.path.join(root_dir, "backend", "main.py")
    if os.path.exists(backend_main_path):
        with open(backend_main_path, "r") as f:
            content = f.read()
        
        # Match VOYARR_VERSION = "..."
        pattern = r'(VOYARR_VERSION\s*=\s*")[^"]*(")'
        new_content, count = re.subn(pattern, rf'\g<1>{version}\g<2>', content)
        
        if count > 0:
            with open(backend_main_path, "w") as f:
                f.write(new_content)
            print(f"Updated {backend_main_path}")
        else:
            print(f"Warning: Could not find VOYARR_VERSION constant definition in {backend_main_path}")

    # 5b. Update environment files (.env and .env.example)
    env_paths = [os.path.join(root_dir, ".env.example"), os.path.join(root_dir, ".env")]
    for env_path in env_paths:
        if os.path.exists(env_path):
            with open(env_path, "r") as f:
                lines = f.readlines()
            
            found = False
            new_lines = []
            for line in lines:
                if line.startswith("VOYARR_VERSION="):
                    new_lines.append(f"VOYARR_VERSION={version}\n")
                    found = True
                else:
                    new_lines.append(line)
            
            # If not found, append under backend config
            if not found:
                new_lines_with_append = []
                appended = False
                for line in new_lines:
                    new_lines_with_append.append(line)
                    if line.strip() == "# Backend Configuration" and not appended:
                        new_lines_with_append.append(f"VOYARR_VERSION={version}\n")
                        appended = True
                if not appended:
                    new_lines_with_append.append(f"\nVOYARR_VERSION={version}\n")
                new_lines = new_lines_with_append
                
            with open(env_path, "w") as f:
                f.writelines(new_lines)
            print(f"Updated {env_path}")

    # 5c. Update docker-compose.yml VOYARR_VERSION environment variables
    docker_compose_path = os.path.join(root_dir, "docker-compose.yml")
    if os.path.exists(docker_compose_path):
        with open(docker_compose_path, "r") as f:
            content = f.read()
        
        pattern = r'(VOYARR_VERSION=\$\{VOYARR_VERSION:-)[^}]*(\})'
        new_content, count = re.subn(pattern, rf'\g<1>{version}\g<2>', content)
        
        if count > 0:
            with open(docker_compose_path, "w") as f:
                f.write(new_content)
            print(f"Updated {docker_compose_path}")
        else:
            print(f"Warning: Could not find VOYARR_VERSION variables in {docker_compose_path}")

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
