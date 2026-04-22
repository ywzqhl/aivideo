from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routers import auth, health, jobs, system, uploads, workbench_state
from app.config import config
from app.services.llm.providers import register_all_providers
from app.utils import utils


def create_app() -> FastAPI:
    register_all_providers()

    app = FastAPI(
        title=f"{config.project_name} Local API",
        version=config.project_version,
        description="Local-first API for the next-generation AIVideo frontend.",
    )

    allow_origins = [origin.strip() for origin in str(os.getenv("AIVIDEO_API_CORS_ORIGINS", "")).split(",") if origin.strip()]
    allow_origin_regex = os.getenv(
        "AIVIDEO_API_CORS_ORIGIN_REGEX",
        r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_origin_regex=allow_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health, prefix="/api/v1")
    app.include_router(system, prefix="/api/v1")
    app.include_router(jobs, prefix="/api/v1")
    app.include_router(auth, prefix="/api/v1")
    app.include_router(uploads, prefix="/api/v1")
    app.include_router(workbench_state, prefix="/api/v1")

    # 挂载上传文件目录为静态文件服务
    upload_root = Path(utils.workspace_dir()) / "frontend_uploads"
    if upload_root.exists():
        app.mount("/uploads", StaticFiles(directory=str(upload_root)), name="uploads")

    # 前端运行时配置接口（前端同源部署时 API_BASE_URL 为空字符串使用相对路径）
    @app.get("/api/config")
    def runtime_config():
        same_origin = os.getenv("AIVIDEO_API_SAME_ORIGIN", "1") == "1"
        if same_origin:
            api_base_url = ""
        else:
            host = config.app.get("local_api_host", "127.0.0.1")
            port = config.app.get("local_api_port", 18000)
            api_base_url = f"http://{host}:{port}"
        return {
            "API_BASE_URL": api_base_url,
            "project_name": config.project_name,
            "project_version": config.project_version,
        }

    # 挂载前端构建产物；放在所有 API 路由之后，用 html=True 支持 SPA 路由兜底
    _web_dist_env = os.getenv("AIVIDEO_WEB_DIST")
    _web_dist_candidates = [
        Path(_web_dist_env) if _web_dist_env else None,
        Path(__file__).resolve().parents[2] / "web" / "dist",
    ]
    for candidate in _web_dist_candidates:
        if candidate and candidate.is_dir():
            app.mount("/", StaticFiles(directory=str(candidate), html=True), name="frontend")
            break

    return app


app = create_app()
