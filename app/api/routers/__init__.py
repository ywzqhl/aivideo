"""API routers."""
from .auth import router as auth
from .health import router as health
from .jobs import router as jobs
from .system import router as system
from .tts import router as tts
from .uploads import router as uploads
from .workbench_state import router as workbench_state

__all__ = ["auth", "health", "jobs", "system", "tts", "uploads", "workbench_state"]
