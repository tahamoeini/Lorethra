"""Local image generation contracts and recovery paths using disposable fixtures."""

from __future__ import annotations

import asyncio
import io
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx
from PIL import Image

from lke.api.app import create_app
from lke.core import CommandGateway, ConflictError, Database, ValidationError
from lke.core.errors import IdempotencyConflictError, NotFoundError
from lke.ops.backup import create_backup, restore_backup_into_database
from lke.story_images import GeneratedImage, LocalComfyUIProvider, LocalImageProviderError, StoryImageJobRunner


def png_bytes() -> bytes:
    image = Image.new("RGB", (8, 8), (90, 120, 180))
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


class FakeLocalImageProvider:
    def __init__(self, *, available: bool = True) -> None:
        self.available = available
        self.submitted: list[dict] = []
        self.poll_count = 0

    def capabilities(self) -> dict:
        return {
            "provider": "comfyui", "label": "Local ComfyUI", "available": self.available,
            "status": "ready" if self.available else "unavailable",
            "message": "Local image creation is ready." if self.available else "Start ComfyUI on this device to create images.",
            "models": ["disposable-model.safetensors"] if self.available else [],
            "supports": {"reference_images": False, "upscale": False},
            "workflow_id": "lorethra-comfy-checkpoint-v1",
        }

    def submit(self, frame: dict) -> tuple[str, dict]:
        self.submitted.append(frame)
        return "provider-job-1", {
            "provider": "comfyui", "workflow_id": "lorethra-comfy-checkpoint-v1",
            "model": "disposable-model.safetensors", "seed": 42,
            "settings": {**frame["settings"], "checkpoint": "disposable-model.safetensors", "seed": 42},
        }

    def poll(self, _provider_job_id: str) -> GeneratedImage:
        self.poll_count += 1
        return GeneratedImage(png_bytes(), "image/png")


class StoryImageFixture(unittest.TestCase):
    def setUp(self) -> None:
        self.database = Database(":memory:")
        self.gateway = CommandGateway(self.database)
        self.workspace_id = "image-test-workspace"
        self.branch_id = "image-test-adventure"
        self.adventure_id = "image-test-adventure"
        self.gateway.create_workspace("Disposable image test", self.workspace_id)
        hero = self.command("hero", 0, "create_entity", {
            "entity_id": "hero", "entity_type": "character", "label": "Mira", "properties": {},
        })
        world = self.command("world", hero["revision"], "create_story_world", {
            "world_id": "image-world", "name": "The Harbor", "template_key": "fantasy",
            "content": {
                "starting_location": "Old Harbor", "locations": ["Old Harbor"],
                "stats": {"might": 1}, "trackers": {"health": {"value": 8, "max": 10}},
                "public_lore": "A town beside a cold sea.",
            },
        })
        self.gateway.create_branch(self.workspace_id, "main", self.branch_id, world["revision"], "image-branch")
        adventure = self.command("adventure", world["revision"], "create_story_adventure", {
            "adventure_id": self.adventure_id, "world_id": "image-world", "world_version": 1,
            "conversation_id": "image-conversation", "name": "Fog on the Coast", "actor_entity_id": "hero",
        }, branch=self.branch_id)
        self.revision = adventure["revision"]

    def tearDown(self) -> None:
        self.database.close()

    def command(self, key: str, revision: int, kind: str, payload: dict, *, branch: str = "main") -> dict:
        return self.gateway.execute(
            workspace_id=self.workspace_id, branch_id=branch, idempotency_key=key,
            expected_revision=revision, command_type=kind, payload=payload, actor="user",
            reason="Disposable local image test",
        )

    def create_job(self, *, count: int = 1, key: str = "image-job", purpose: str = "portrait", target_id: str = "hero") -> dict:
        return self.gateway.create_story_image_job(
            workspace_id=self.workspace_id, branch_id=self.branch_id, adventure_id=self.adventure_id,
            expected_revision=self.revision, idempotency_key=key, purpose=purpose,
            target_kind="character" if purpose == "portrait" else "scene", target_id=target_id,
            prompt="A thoughtful portrait of Mira beside a foggy harbor.",
            negative_prompt="blurry", settings={"seed": 42}, frame_count=count,
        )


class StoryImageGatewayTests(StoryImageFixture):
    def test_job_submission_is_idempotent_revision_neutral_and_branch_scoped(self) -> None:
        created = self.create_job(count=2)
        self.assertEqual(created["status"], "queued")
        self.assertEqual(self.gateway.current_revision(self.workspace_id, self.branch_id), self.revision)
        replay = self.create_job(count=2)
        self.assertEqual(replay["job_id"], created["job_id"])
        self.assertTrue(replay["replayed"])
        with self.assertRaises(IdempotencyConflictError):
            self.gateway.create_story_image_job(
                workspace_id=self.workspace_id, branch_id=self.branch_id, adventure_id=self.adventure_id,
                expected_revision=self.revision, idempotency_key="image-job", purpose="portrait",
                target_kind="character", target_id="hero", prompt="A different request.", frame_count=2,
            )
        with self.assertRaises(NotFoundError):
            self.gateway.get_story_image_job(self.workspace_id, "main", self.adventure_id, created["job_id"])
        job = self.gateway.get_story_image_job(self.workspace_id, self.branch_id, self.adventure_id, created["job_id"])
        self.assertEqual([frame["status"] for frame in job["frames"]], ["queued", "queued"])
        self.assertEqual(job["source_revision"], self.revision)

    def test_stop_preserves_running_result_and_attachment_uses_trusted_provenance(self) -> None:
        created = self.create_job(count=2)
        job_id = created["job_id"]
        frame = self.gateway.claim_next_story_image_frame()
        self.assertIsNotNone(frame)
        self.gateway.set_story_image_provider_job_id(
            self.workspace_id, self.branch_id, self.adventure_id, job_id, frame["frame_id"],
            "provider-job-1", {"provider": "comfyui", "model": "disposable-model", "seed": 42},
        )
        stopped = self.gateway.request_story_image_job_stop(
            self.workspace_id, self.branch_id, self.adventure_id, job_id, "stop-image-job",
        )
        self.assertEqual([item["status"] for item in stopped["frames"]], ["running", "cancelled"])
        completed = self.gateway.complete_story_image_frame(
            self.workspace_id, self.branch_id, self.adventure_id, job_id, frame["frame_id"],
            mime_type="image/png", content=png_bytes(),
            recipe={"provider": "comfyui", "model": "disposable-model", "seed": 42},
        )
        replay = self.gateway.complete_story_image_frame(
            self.workspace_id, self.branch_id, self.adventure_id, job_id, frame["frame_id"],
            mime_type="image/png", content=png_bytes(),
            recipe={"provider": "comfyui", "model": "disposable-model", "seed": 42},
        )
        self.assertEqual(completed["candidate_id"], replay["candidate_id"])
        job = self.gateway.get_story_image_job(self.workspace_id, self.branch_id, self.adventure_id, job_id)
        self.assertEqual(job["status"], "stopped")
        self.assertEqual(len(self.gateway.list_story_image_candidates(self.workspace_id, self.branch_id, self.adventure_id)), 1)
        attached = self.command("attach-image-candidate", self.revision, "add_story_asset", {
            "adventure_id": self.adventure_id, "target_kind": "character", "target_id": "hero",
            "display_name": "Mira portrait", "candidate_id": completed["candidate_id"],
            "mime_type": "image/jpeg", "data_base64": "client-data-must-be-ignored",
            "provenance": {"provider": "spoofed"},
        }, branch=self.branch_id)
        asset = self.gateway.get_story_asset(
            self.workspace_id, self.branch_id, self.adventure_id, attached["asset_id"],
        )
        self.assertEqual(asset["content"], png_bytes())
        self.assertEqual(asset["mime_type"], "image/png")
        self.assertEqual(asset["provenance"]["origin"], "local_comfyui")
        self.assertNotEqual(asset["provenance"].get("provider"), "spoofed")
        with self.assertRaises(sqlite3.IntegrityError):
            self.database.connection.execute(
                "UPDATE story_image_candidates SET sha256='tampered' WHERE candidate_id=?",
                (completed["candidate_id"],),
            )

    def test_failed_frame_requires_explicit_retry_and_invalid_candidate_bytes_are_rejected(self) -> None:
        created = self.create_job(key="retry-job")
        frame = self.gateway.claim_next_story_image_frame()
        self.gateway.fail_story_image_frame(
            self.workspace_id, self.branch_id, self.adventure_id, created["job_id"], frame["frame_id"],
            error_code="provider_failed", error_message="ComfyUI reported that image generation failed.",
        )
        retried = self.gateway.retry_story_image_frame(
            self.workspace_id, self.branch_id, self.adventure_id, created["job_id"], frame["frame_id"], "retry-image-frame",
        )
        self.assertEqual(retried["frames"][0]["status"], "queued")
        self.assertEqual(self.gateway.retry_story_image_frame(
            self.workspace_id, self.branch_id, self.adventure_id, created["job_id"], frame["frame_id"], "retry-image-frame",
        )["frames"][0]["status"], "queued")
        frame = self.gateway.claim_next_story_image_frame()
        with self.assertRaises(ConflictError):
            self.gateway.retry_story_image_frame(
                self.workspace_id, self.branch_id, self.adventure_id, created["job_id"], frame["frame_id"], "retry-while-running",
            )
        with self.assertRaises(ValidationError):
            self.gateway.complete_story_image_frame(
                self.workspace_id, self.branch_id, self.adventure_id, created["job_id"], frame["frame_id"],
                mime_type="image/png", content=b"not an image", recipe={"seed": 1},
            )
        self.gateway.interrupt_story_image_frame(
            self.workspace_id, self.branch_id, self.adventure_id, created["job_id"], frame["frame_id"],
            "Provider result is uncertain", allow_reconcile=False,
        )
        self.assertEqual(self.gateway.list_recoverable_story_image_frames(), [])

    def test_scene_target_must_be_an_active_turn_in_the_same_adventure(self) -> None:
        with self.assertRaises(NotFoundError):
            self.create_job(key="invalid-scene", purpose="scene", target_id="foreign-turn")

    def test_backup_restore_preserves_candidate_bytes_recipe_and_event_history(self) -> None:
        created = self.create_job(key="backup-image-job")
        frame = self.gateway.claim_next_story_image_frame()
        recipe = {"provider": "comfyui", "workflow_id": "test", "model": "disposable", "seed": 42}
        self.gateway.set_story_image_provider_job_id(
            self.workspace_id, self.branch_id, self.adventure_id, created["job_id"],
            frame["frame_id"], "provider-job-1", recipe,
        )
        candidate = self.gateway.complete_story_image_frame(
            self.workspace_id, self.branch_id, self.adventure_id, created["job_id"], frame["frame_id"],
            mime_type="image/png", content=png_bytes(), recipe=recipe,
        )
        attached = self.command("backup-attach-image", self.revision, "add_story_asset", {
            "adventure_id": self.adventure_id, "target_kind": "character", "target_id": "hero",
            "display_name": "Mira portrait", "candidate_id": candidate["candidate_id"],
            "mime_type": "image/jpeg", "data_base64": "client-data-must-be-ignored",
            "provenance": {"provider": "spoofed"},
        }, branch=self.branch_id)
        expected_job = self.gateway.get_story_image_job(
            self.workspace_id, self.branch_id, self.adventure_id, created["job_id"],
        )
        expected_asset = self.gateway.get_story_asset(
            self.workspace_id, self.branch_id, self.adventure_id, attached["asset_id"],
        )
        expected_candidates = self.gateway.list_story_image_candidates(
            self.workspace_id, self.branch_id, self.adventure_id,
        )
        restored = Database(":memory:")
        try:
            with tempfile.TemporaryDirectory() as directory:
                backup_path = Path(directory) / "synthetic-image-backup.lkebackup"
                create_backup(self.database, backup_path)
                restore_backup_into_database(restored, backup_path)
            restored_gateway = CommandGateway(restored)
            actual = restored_gateway.get_story_image_candidate(
                self.workspace_id, self.branch_id, self.adventure_id, candidate["candidate_id"],
            )
            self.assertEqual(actual["content"], png_bytes())
            self.assertEqual(actual["recipe"], recipe)
            restored_job = restored_gateway.get_story_image_job(
                self.workspace_id, self.branch_id, self.adventure_id, created["job_id"],
            )
            self.assertEqual(restored_job, expected_job)
            self.assertIn("provider_submitted", [event["event_type"] for event in restored_job["events"]])
            restored_asset = restored_gateway.get_story_asset(
                self.workspace_id, self.branch_id, self.adventure_id, attached["asset_id"],
            )
            self.assertEqual(restored_asset, expected_asset)
            self.assertEqual(restored_asset["content"], png_bytes())
            self.assertEqual(restored_asset["mime_type"], "image/png")
            self.assertEqual(restored_asset["provenance"]["candidate_id"], candidate["candidate_id"])
            self.assertEqual(restored_asset["provenance"]["origin"], "local_comfyui")
            self.assertEqual(
                restored_gateway.list_story_image_candidates(
                    self.workspace_id, self.branch_id, self.adventure_id,
                ),
                expected_candidates,
            )
            self.assertEqual(expected_candidates[0]["attached_asset_id"], attached["asset_id"])
        finally:
            restored.close()


class LocalComfyUIProviderTests(unittest.TestCase):
    def test_only_plain_http_loopback_addresses_are_accepted(self) -> None:
        self.assertIsNotNone(LocalComfyUIProvider("http://127.0.0.1:8188").base_url)
        self.assertIsNotNone(LocalComfyUIProvider("http://[::1]:8188").base_url)
        for url in (
            "https://127.0.0.1:8188", "http://8.8.8.8:8188", "http://127.0.0.1:8188/workflow",
            "http://user:pass@127.0.0.1:8188", "http://localhost.example:8188",
        ):
            with self.subTest(url=url):
                provider = LocalComfyUIProvider(url)
                self.assertIsNone(provider.base_url)
                self.assertFalse(provider.capabilities()["available"])

    def test_capability_discovery_and_fixed_workflow_use_only_explicit_visual_prompt(self) -> None:
        provider = LocalComfyUIProvider()
        checkpoint_info = {"CheckpointLoaderSimple": {"input": {"required": {
            "ckpt_name": [["disposable-model.safetensors"]],
        }}}}
        with patch.object(provider, "_request_json", side_effect=[{"system": {}}, checkpoint_info]):
            capabilities = provider.capabilities()
        self.assertTrue(capabilities["available"])
        self.assertFalse(capabilities["supports"]["reference_images"])
        with patch.object(provider, "capabilities", return_value=capabilities), patch.object(
            provider, "_request_json", return_value={"prompt_id": "provider-job-1"},
        ) as post:
            prompt_id, recipe = provider.submit({
                "settings": {"width": 512, "height": 512, "steps": 24, "cfg": 7.0, "seed": 42},
                "prompt": "A Persian harbor portrait.", "negative_prompt": "blurry", "reference_asset_ids": [],
            })
        self.assertEqual(prompt_id, "provider-job-1")
        workflow = post.call_args.kwargs["payload"]["prompt"]
        self.assertEqual(workflow["2"]["inputs"]["text"], "A Persian harbor portrait.")
        self.assertEqual(workflow["3"]["inputs"]["text"], "blurry")
        self.assertEqual(workflow["5"]["inputs"]["seed"], 42)
        self.assertEqual(recipe["workflow_id"], "lorethra-comfy-checkpoint-v1")

    def test_provider_output_is_decoded_before_it_becomes_a_candidate(self) -> None:
        provider = LocalComfyUIProvider()
        provider._request_json = lambda _path: {
            "provider-job-1": {
                "status": {"status_str": "success", "completed": True},
                "outputs": {"7": {"images": [{"filename": "candidate.png", "subfolder": "", "type": "output"}]}},
            },
        }
        provider._request_bytes = lambda _path, _limit: png_bytes()
        result = provider.poll("provider-job-1")
        self.assertEqual(result.mime_type, "image/png")
        with self.assertRaises(LocalImageProviderError):
            provider.poll("bad/id")


class StoryImageRunnerTests(StoryImageFixture):
    def test_runner_persists_a_candidate_without_changing_story_revision(self) -> None:
        created = self.create_job(key="runner-job")
        provider = FakeLocalImageProvider()
        runner = StoryImageJobRunner(self.gateway, provider)  # type: ignore[arg-type]

        async def run() -> None:
            await runner.start()
            await runner.kick()
            for _ in range(100):
                if self.gateway.list_story_image_candidates(self.workspace_id, self.branch_id, self.adventure_id):
                    break
                await asyncio.sleep(0.02)
            await runner.stop()

        asyncio.run(run())
        job = self.gateway.get_story_image_job(self.workspace_id, self.branch_id, self.adventure_id, created["job_id"])
        self.assertEqual(job["status"], "succeeded")
        self.assertEqual(len(provider.submitted), 1)
        self.assertEqual(self.gateway.current_revision(self.workspace_id, self.branch_id), self.revision)


class StoryImageApiTests(StoryImageFixture):
    def test_authenticated_api_creates_lists_and_attaches_candidate(self) -> None:
        provider = FakeLocalImageProvider()
        app = create_app(self.database, auth_token="image-test-token", image_provider=provider)  # type: ignore[arg-type]
        headers = {"Authorization": "Bearer image-test-token"}
        base = f"/api/v1/workspaces/{self.workspace_id}/story/adventures/{self.adventure_id}"

        async def run() -> tuple[dict, dict, httpx.Response]:
            await app.state.image_job_runner.start()
            transport = httpx.ASGITransport(app=app, client=("127.0.0.1", 8000))
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                self.assertEqual((await client.get("/api/v1/providers/images/comfyui")).status_code, 401)
                capabilities = await client.get("/api/v1/providers/images/comfyui", headers=headers)
                self.assertTrue(capabilities.json()["available"])
                create = await client.post(f"{base}/image-jobs", headers=headers, json={
                    "branch_id": self.branch_id, "expected_revision": self.revision,
                    "idempotency_key": "api-image-job", "purpose": "portrait", "target_kind": "character",
                    "target_id": "hero", "prompt": "Mira beside the harbor", "settings": {"seed": 42},
                })
                self.assertEqual(create.status_code, 202, create.text)
                job_id = create.json()["job_id"]
                for _ in range(100):
                    job = await client.get(f"{base}/image-jobs/{job_id}?branch_id={self.branch_id}", headers=headers)
                    if job.json()["status"] == "succeeded":
                        break
                    await asyncio.sleep(0.02)
                candidates = await client.get(f"{base}/image-candidates?branch_id={self.branch_id}", headers=headers)
                candidate_id = candidates.json()["candidates"][0]["candidate_id"]
                attached = await client.post(
                    f"{base}/image-candidates/{candidate_id}/attach", headers=headers,
                    json={
                        "branch_id": self.branch_id, "expected_revision": self.revision,
                        "idempotency_key": "api-attach-image", "display_name": "Mira generated portrait",
                    },
                )
                listing = await client.get(f"{base}/image-jobs?branch_id={self.branch_id}", headers=headers)
                await app.state.image_job_runner.stop()
                return create.json(), listing.json(), attached

        created, listing, attached = asyncio.run(run())
        self.assertEqual(created["status"], "queued")
        self.assertEqual(listing["jobs"][0]["status"], "succeeded")
        self.assertEqual(attached.status_code, 200, attached.text)

