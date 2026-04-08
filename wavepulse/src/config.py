"""
Global config shared across all the processes to keep track of if the application is running or not.
Used in background listeners to keep checking if the application is running or shutting down.
"""

from multiprocessing import Manager
import multiprocessing

# Initialize manager and shared config only when needed
_manager = None
_shared_config = None

def get_shared_config():
    """Get or create shared config dictionary"""
    global _manager, _shared_config
    if _manager is None:
        _manager = Manager()
        _shared_config = _manager.dict()
        _shared_config["running"] = False
    return _shared_config

# Lazy initialization for shared_config
shared_config = None

def init_shared_config():
    """Initialize shared config - call this from main process"""
    global shared_config
    if shared_config is None:
        shared_config = get_shared_config()
    return shared_config
