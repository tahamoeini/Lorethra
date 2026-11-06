"""Local-only ComfyUI image generation and durable job coordination."""

from __future__ import annotations

import asyncio
import ipaddress
import json
import os
import secrets
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from io import BytesIO
from typing import Any

from PIL import Image, UnidentifiedImageError

from lke.core.commands import CommandGateway


_MAX_IMAGE_BYTES = 5 * 1024 * 1024
_MAX_JSON_BYTES = 4 * 1024 * 1024
_WORKFLOW_ID = "lorethra-comfy-checkpoint-v1"


class LocalImageProviderError(Exception):
    def __init__(self, code: str, public_message: str) -> None:
        super().__init__(public_message)
        self.code = code
        self.public_message = public_message


@dataclass(frozen=True)
class GeneratedImage:
    content: bytes
    mime_type: str


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        return None


class LocalComfyUIProvider:
    """Submit a fixed application-owned workflow to loopback ComfyUI only."""

    def __init__(self, base_url: str | None = None, timeout: float = 3.0) -> None:
        raw_url = base_url or os.environ.get("LKE_COMFYUI_URL", "http://127.0.0.1:8188")
        self.timeout = timeout
        self.base_url, self.configuration_error = self._validated_base_url(raw_url)
        self._opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), _NoRedirect())

    @staticmethod
    def _validated_base_url(raw_url: str) -> tuple[str | None, str | None]:
        try:
            parsed = urllib.parse.urlsplit(raw_url)
            host = parsed.hostname or ""
            try:
                is_loopback = ipaddress.ip_address(host.split("%", 1)[0]).is_loopback
            except ValueError:
                is_loopback = host.lower() == "localhost"
            if (
                parsed.scheme != "http" or not is_loopback or parsed.username or parsed.password
                or parsed.path not in {"", "/"} or parsed.query or parsed.fragment
            ):
                return None, "ComfyUI must use an HTTP loopback address without credentials or a path."
            port = parsed.port
            netloc = f"[{host}]" if ":" in host else host
            if port is not None:
                netloc += f":{port}"
            return f"http://{netloc}", None
        except (TypeError, ValueError):
            return None, "ComfyUI address is invalid."

    def capabilities(self) -> dict[str, Any]:
        base = {
            "provider": "comfyui",
            "label": "Local ComfyUI",
            "available": False,
            "status": "unavailable",
            "message": "Start ComfyUI on this device to create images.",
            "models": [],
            "supports": {
                "seed": True,
                "width": True,
                "height": True,
                "negative_prompt": True,
                "reference_images": False,
                "image_description": False,
                "variation": False,
                "upscale": False,
            },
            "workflow_id": _WORKFLOW_ID,
        }
        if self.configuration_error:
            return {**base, "status": "unsafe_configuration", "message": self.configuration_error}
        try:
            self._request_json("/system_stats")
            node = self._request_json("/object_info/CheckpointLoaderSimple")
            models = self._checkpoint_choices(node)
        except LocalImageProviderError:
            return base
        if not models:
            return {**base, "status": "no_models", "message": "ComfyUI is running, but no compatible checkpoint is available."}
        return {**base, "available": True, "status": "ready", "message": "Local image creation is ready.", "models": models}

    @staticmethod
    def _checkpoint_choices(node: Any) -> list[str]:
        try:
            choice_list = node["CheckpointLoaderSimple"]["input"]["required"]["ckpt_name"][0]
            return sorted({choice for choice in choice_list if isinstance(choice, str) and 0 < len(choice) <= 200})
        except (KeyError, IndexError, TypeError):
            return []

    def submit(self, frame: dict[str, Any]) -> tuple[str, dict[str, Any]]:
        if frame.get("reference_asset_ids"):
            raise LocalImageProviderError("unsupported_references", "This local workflow cannot use reference images yet.")
        capabilities = self.capabilities()
        if not capabilities["available"]:
            raise LocalImageProviderError("provider_unavailable", capabilities["message"])
        settings = dict(frame["settings"])
        models = capabilities["models"]
        checkpoint = settings.get("checkpoint")
        if checkpoint is None and len(models) == 1:
            checkpoint = models[0]
        if checkpoint not in models:
            raise LocalImageProviderError("checkpoint_unavailable", "Choose an installed ComfyUI checkpoint before generating.")
        settings["checkpoint"] = checkpoint
        settings["seed"] = settings.get("seed", secrets.randbits(32))
        recipe = {
            "provider": "comfyui",
            "workflow_id": _WORKFLOW_ID,
            "model": checkpoint,
            "seed": settings["seed"],
            "settings": settings,
        }
        response = self._request_json("/prompt", method="POST", payload={"prompt": self._workflow(frame, settings)})
        prompt_id = response.get("prompt_id") if isinstance(response, dict) else None
        if not isinstance(prompt_id, str) or not prompt_id or len(prompt_id) > 200:
            raise LocalImageProviderError("invalid_submission", "ComfyUI did not return a valid job identifier.")
        return prompt_id, recipe

    @staticmethod
    def _workflow(frame: dict[str, Any], settings: dict[str, Any]) -> dict[str, Any]:
        prompt = frame["prompt"]
        negative = frame["negative_prompt"]
        return {
            "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": settings["checkpoint"]}},
            "2": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["1", 1]}},
            "3": {"class_type": "CLIPTextEncode", "inputs": {"text": negative, "clip": ["1", 1]}},
            "4": {"class_type": "EmptyLatentImage", "inputs": {
                "width": settings["width"], "height": settings["height"], "batch_size": 1,
            }},
            "5": {"class_type": "KSampler", "inputs": {
                "seed": settings["seed"], "steps": settings["steps"], "cfg": settings["cfg"],
                "sampler_name": "euler", "scheduler": "normal", "denoise": 1.0,
                "model": ["1", 0], "positive": ["2", 0], "negative": ["3", 0], "latent_image": ["4", 0],
            }},
            "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
            "7": {"class_type": "SaveImage", "inputs": {"filename_prefix": "lorethra/candidate", "images": ["6", 0]}},
        }

    def poll(self, provider_job_id: str) -> GeneratedImage | None:
        if not provider_job_id or len(provider_job_id) > 200 or any(char not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_" for char in provider_job_id):
            raise LocalImageProviderError("invalid_provider_job", "The local provider returned an invalid job identifier.")
        history = self._request_json(f"/history/{urllib.parse.quote(provider_job_id, safe='')}")
        item = history.get(provider_job_id) if isinstance(history, dict) else None
        if not isinstance(item, dict):
            return None
        status = item.get("status", {})
        if isinstance(status, dict) and status.get("status_str") == "error":
            raise LocalImageProviderError("provider_failed", "ComfyUI reported that image generation failed.")
        outputs = item.get("outputs", {})
        images = [
            image for output in outputs.values() if isinstance(output, dict)
            for image in output.get("images", []) if isinstance(image, dict)
        ] if isinstance(outputs, dict) else []
        if not images:
            if isinstance(status, dict) and status.get("completed"):
                raise LocalImageProviderError("empty_output", "ComfyUI completed without returning an image.")
            return None
        image = images[0]
        filename, subfolder, image_type = image.get("filename"), image.get("subfolder", ""), image.get("type", "output")
        if (
            not isinstance(filename, str) or not filename or len(filename) > 255
            or not isinstance(subfolder, str) or len(subfolder) > 500
            or image_type not in {"output", "temp", "input"}
        ):
            raise LocalImageProviderError("invalid_output", "ComfyUI returned an invalid image reference.")
        query = urllib.parse.urlencode({"filename": filename, "subfolder": subfolder, "type": image_type})
        content = self._request_bytes(f"/view?{query}", _MAX_IMAGE_BYTES)
        return GeneratedImage(content, self._validated_image_mime(content))

    @staticmethod
    def _validated_image_mime(content: bytes) -> str:
        try:
            with Image.open(BytesIO(content)) as image:
                if image.width > 8192 or image.height > 8192 or image.width * image.height > 20_000_000:
                    raise LocalImageProviderError("image_too_large", "The generated image dimensions exceed the safe limit.")
                image.verify()
                return {"PNG": "image/png", "JPEG": "image/jpeg", "WEBP": "image/webp"}[image.format]
        except (UnidentifiedImageError, OSError, KeyError, ValueError) as error:
            if isinstance(error, LocalImageProviderError):
                raise
            raise LocalImageProviderError("invalid_image", "ComfyUI returned an invalid or unsupported image.") from error

    def _request_json(self, path: str, *, method: str = "GET", payload: dict[str, Any] | None = None) -> Any:
        body = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode("utf-8") if payload is not None else None
        headers = {"Accept": "application/json"}
        if body is not None:
            headers["Content-Type"] = "application/json"
        request = urllib.request.Request(f"{self.base_url}{path}", data=body, headers=headers, method=method)
        response = self._open(request, _MAX_JSON_BYTES)
        try:
            return json.loads(response.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise LocalImageProviderError("invalid_provider_response", "ComfyUI returned an invalid response.") from error

    def _request_bytes(self, path: str, limit: int) -> bytes:
        request = urllib.request.Request(f"{self.base_url}{path}", headers={"Accept": "image/png,image/jpeg,image/webp"})
        return self._open(request, limit)

    def _open(self, request: urllib.request.Request, limit: int) -> bytes:
        if not self.base_url:
            raise LocalImageProviderError("unsafe_configuration", self.configuration_error or "ComfyUI address is invalid.")
        try:
            with self._opener.open(request, timeout=self.timeout) as response:
                content_length = response.headers.get("Content-Length")
                if content_length and content_length.isdigit() and int(content_length) > limit:
                    raise LocalImageProviderError("response_too_large", "The local provider response exceeds the size limit.")
                content = response.read(limit + 1)
                if len(content) > limit:
                    raise LocalImageProviderError("response_too_large", "The local provider response exceeds the size limit.")
                return content
        except LocalImageProviderError:
            raise
        except urllib.error.HTTPError as error:
            code = "provider_job_missing" if error.code == 404 and "/history/" in request.full_url else "provider_http_error"
            message = "ComfyUI no longer has this job." if code == "provider_job_missing" else "ComfyUI could not complete the local image request."
            raise LocalImageProviderError(code, message) from error
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            raise LocalImageProviderError("provider_unavailable", "ComfyUI is not responding on this device.") from error


class StoryImageJobRunner:
    """Run one durable local image frame at a time and never resubmit uncertain work."""

    def __init__(self, gateway: CommandGateway, provider: LocalComfyUIProvider) -> None:
        self.gateway = gateway
        self.provider = provider
        self._task: asyncio.Task[None] | None = None
        self._wake: asyncio.Event | None = None
        self._stopping = False

    async def start(self) -> None:
        if self._task and not self._task.done():
            return
        self._stopping = False
        self._wake = asyncio.Event()
        self._task = asyncio.create_task(self._run(), name="lorethra-local-image-queue")

    async def kick(self) -> None:
        await self.start()
        if self._wake:
            self._wake.set()

    async def stop(self) -> None:
        self._stopping = True
        if self._wake:
            self._wake.set()
        if self._task:
            try:
                await asyncio.wait_for(self._task, timeout=5)
            except asyncio.TimeoutError:
                self._task.cancel()
                try:
                    await self._task
                except asyncio.CancelledError:
                    pass
            self._task = None
        for frame in self.gateway.list_running_story_image_frames():
            self.gateway.interrupt_story_image_frame(
                frame["workspace_id"], frame["branch_id"], frame["adventure_id"], frame["job_id"], frame["frame_id"],
                "Lorethra stopped while the local provider was processing this image",
            )

    async def _run(self) -> None:
        await self._recover_after_restart()
        while not self._stopping:
            try:
                capabilities = await asyncio.to_thread(self.provider.capabilities)
                if not capabilities["available"]:
                    await self._wait(4)
                    continue
                recoverable = self.gateway.list_recoverable_story_image_frames()
                if recoverable:
                    await self._resume_frame(recoverable[0])
                    continue
                frame = self.gateway.claim_next_story_image_frame()
                if frame is None:
                    await self._wait(2)
                    continue
                await self._start_frame(frame)
            except asyncio.CancelledError:
                raise
            except Exception:
                await self._wait(2)

    async def _recover_after_restart(self) -> None:
        for frame in self.gateway.list_running_story_image_frames():
            reason = (
                "Checking the saved ComfyUI job after restart"
                if frame["provider_job_id"]
                else "No provider job identifier was saved; retry is required"
            )
            self.gateway.interrupt_story_image_frame(
                frame["workspace_id"], frame["branch_id"], frame["adventure_id"], frame["job_id"], frame["frame_id"],
                reason, allow_reconcile=bool(frame["provider_job_id"]),
            )

    async def _start_frame(self, frame: dict[str, Any]) -> None:
        try:
            provider_job_id, recipe = await asyncio.to_thread(self.provider.submit, frame)
            self.gateway.set_story_image_provider_job_id(
                frame["workspace_id"], frame["branch_id"], frame["adventure_id"], frame["job_id"],
                frame["frame_id"], provider_job_id, recipe,
            )
            await self._poll_frame(frame, provider_job_id, recipe)
        except LocalImageProviderError as error:
            if error.code in {"provider_unavailable", "provider_job_missing"}:
                self.gateway.interrupt_story_image_frame(
                    frame["workspace_id"], frame["branch_id"], frame["adventure_id"], frame["job_id"],
                    frame["frame_id"], error.public_message,
                )
            else:
                self.gateway.fail_story_image_frame(
                    frame["workspace_id"], frame["branch_id"], frame["adventure_id"], frame["job_id"], frame["frame_id"],
                    error_code=error.code, error_message=error.public_message,
                )
        except Exception:
            self.gateway.fail_story_image_frame(
                frame["workspace_id"], frame["branch_id"], frame["adventure_id"], frame["job_id"], frame["frame_id"],
                error_code="provider_error", error_message="The local image job failed unexpectedly.",
            )

    async def _resume_frame(self, frame: dict[str, Any]) -> None:
        self.gateway.resume_story_image_frame(
            frame["workspace_id"], frame["branch_id"], frame["adventure_id"], frame["job_id"], frame["frame_id"],
        )
        await self._poll_frame(frame, frame["provider_job_id"], frame["recipe"])

    async def _poll_frame(self, frame: dict[str, Any], provider_job_id: str, recipe: dict[str, Any]) -> None:
        started = asyncio.get_running_loop().time()
        while not self._stopping:
            if asyncio.get_running_loop().time() - started > 1800:
                self.gateway.interrupt_story_image_frame(
                    frame["workspace_id"], frame["branch_id"], frame["adventure_id"], frame["job_id"],
                    frame["frame_id"], "ComfyUI did not finish this image within 30 minutes", allow_reconcile=False,
                )
                return
            try:
                generated = await asyncio.to_thread(self.provider.poll, provider_job_id)
            except LocalImageProviderError as error:
                if error.code in {"provider_unavailable", "provider_job_missing"}:
                    self.gateway.interrupt_story_image_frame(
                        frame["workspace_id"], frame["branch_id"], frame["adventure_id"], frame["job_id"],
                        frame["frame_id"], error.public_message,
                        allow_reconcile=error.code != "provider_job_missing",
                    )
                else:
                    self.gateway.fail_story_image_frame(
                        frame["workspace_id"], frame["branch_id"], frame["adventure_id"], frame["job_id"], frame["frame_id"],
                        error_code=error.code, error_message=error.public_message,
                    )
                return
            if generated:
                try:
                    self.gateway.complete_story_image_frame(
                        frame["workspace_id"], frame["branch_id"], frame["adventure_id"], frame["job_id"], frame["frame_id"],
                        mime_type=generated.mime_type, content=generated.content, recipe=recipe,
                    )
                except Exception:
                    self.gateway.fail_story_image_frame(
                        frame["workspace_id"], frame["branch_id"], frame["adventure_id"], frame["job_id"], frame["frame_id"],
                        error_code="invalid_output", error_message="The local image output could not be saved safely.",
                    )
                return
            await self._wait(1)
        self.gateway.interrupt_story_image_frame(
            frame["workspace_id"], frame["branch_id"], frame["adventure_id"], frame["job_id"], frame["frame_id"],
            "Lorethra stopped while the local provider was processing this image",
        )

    async def _wait(self, seconds: float) -> None:
        if not self._wake:
            await asyncio.sleep(seconds)
            return
        self._wake.clear()
        try:
            await asyncio.wait_for(self._wake.wait(), timeout=seconds)
        except asyncio.TimeoutError:
            pass
