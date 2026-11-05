from pathlib import Path
import sys
for dependency_path in (
    r'F:\Projects\The Timeless Sovereign\.venv\Lib\site-packages',
    r'C:\Users\Taha\AppData\Local\Programs\Python\Python313\Lib\site-packages',
):
    if Path(dependency_path).is_dir() and dependency_path not in sys.path:
        sys.path.insert(0, dependency_path)
