"""Run helper that attempts to import the `app` package's create_app factory.
This repo sometimes contains both an `app.py` module and an `app/` package
which can cause import shadowing. We try to import from the package first and
fall back to the simple module import if needed.
"""
import importlib.util
import sys
from pathlib import Path

def load_create_app():
    # First try the normal import (should work now that top-level app.py is removed)
    try:
        from app import create_app as factory
        return factory
    except Exception:
        pass

    # Fallback: explicitly load app/__init__.py by path to avoid any
    # import resolution edge-cases.
    base = Path(__file__).parent
    pkg_init = base / 'app' / '__init__.py'
    if pkg_init.exists():
        spec = importlib.util.spec_from_file_location('app', str(pkg_init))
        module = importlib.util.module_from_spec(spec)
        sys.modules['app'] = module
        spec.loader.exec_module(module)
        if hasattr(module, 'create_app'):
            return getattr(module, 'create_app')

    raise ImportError('Could not import create_app from app package or module')


create_app = load_create_app()
app = create_app()


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)