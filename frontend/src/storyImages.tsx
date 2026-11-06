import { FormEvent, memo, useEffect, useMemo, useState } from "react";
import {
  newId,
  request,
  StoryAdventure,
  StoryImageCandidate,
  StoryImageCapabilities,
  StoryImageJob,
  StoryNpc,
  StoryTurn,
  StoryVisualProfile,
} from "./api";

type Props = {
  enabled: boolean;
  workspaceId: string;
  branchId: string;
  adventure: StoryAdventure;
  revision: number;
  npcs: StoryNpc[];
  turns: StoryTurn[];
  visualProfiles: StoryVisualProfile[];
  onRevisionChange: (revision: number) => void;
};

type CandidatePreview = { candidateId: string; dataUrl: string };

function StoryImageWorkspaceView({
  enabled,
  workspaceId,
  branchId,
  adventure,
  revision,
  npcs,
  turns,
  visualProfiles,
  onRevisionChange,
}: Props) {
  const [capabilities, setCapabilities] = useState<StoryImageCapabilities | null>(null);
  const [jobs, setJobs] = useState<StoryImageJob[]>([]);
  const [candidates, setCandidates] = useState<StoryImageCandidate[]>([]);
  const [target, setTarget] = useState(`character:${adventure.actor_entity_id}`);
  const [direction, setDirection] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [frameCount, setFrameCount] = useState(1);
  const [model, setModel] = useState("");
  const [width, setWidth] = useState(768);
  const [height, setHeight] = useState(768);
  const [steps, setSteps] = useState(24);
  const [cfg, setCfg] = useState(7);
  const [seed, setSeed] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshingProvider, setRefreshingProvider] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<CandidatePreview | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  const basePath = `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/story/adventures/${encodeURIComponent(adventure.adventure_id)}`;
  const sceneTurns = useMemo(
    () => turns.filter((turn) => turn.role === "assistant" && turn.status === "active"),
    [turns],
  );
  const targetKind = target.startsWith("scene:") ? "scene" : "character";
  const targetId = target.slice(target.indexOf(":") + 1);
  const selectedProfile = targetKind === "character"
    ? visualProfiles.find((profile) => profile.entity_id === targetId)
    : undefined;
  const profilePrompt = [
    selectedProfile?.appearance,
    selectedProfile?.distinguishing_features,
    selectedProfile?.style_guidance,
  ].filter((part) => part?.trim()).join(". ");
  const fullPrompt = [profilePrompt, direction].filter((part) => part.trim()).join(". ");
  const promptTooLong = fullPrompt.length > 4000;
  const hasActiveJobs = jobs.some((job) => job.status === "queued" || job.status === "running");

  useEffect(() => {
    setTarget(`character:${adventure.actor_entity_id}`);
    setDirection("");
    setError("");
    setNotice("");
    setPreview(null);
  }, [adventure.adventure_id, adventure.actor_entity_id]);

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    let pollTimer: number | undefined;
    const requestPath = `${basePath}/image-jobs?branch_id=${encodeURIComponent(branchId)}`;
    const candidatesPath = `${basePath}/image-candidates?branch_id=${encodeURIComponent(branchId)}`;

    const load = async (includeProvider: boolean) => {
      try {
        const [jobResult, candidateResult, providerResult] = await Promise.all([
          request<{ jobs: StoryImageJob[] }>(requestPath),
          request<{ candidates: StoryImageCandidate[] }>(candidatesPath),
          includeProvider
            ? request<StoryImageCapabilities>("/api/v1/providers/images/comfyui")
            : Promise.resolve(null),
        ]);
        if (!current) return;
        setJobs(jobResult.jobs);
        setCandidates(candidateResult.candidates);
        if (providerResult) setCapabilities(providerResult);
        if (jobResult.jobs.some((job) => job.status === "queued" || job.status === "running")) {
          pollTimer = window.setTimeout(() => void load(false), 1500);
        }
      } catch (loadError) {
        if (current) {
          setError(loadError instanceof Error ? loadError.message : "Image history could not be loaded.");
        }
      }
    };

    void load(true);
    return () => {
      current = false;
      if (pollTimer !== undefined) window.clearTimeout(pollTimer);
    };
  }, [basePath, branchId, enabled, refreshVersion]);

  async function refreshProvider() {
    setRefreshingProvider(true);
    setError("");
    try {
      setCapabilities(await request<StoryImageCapabilities>("/api/v1/providers/images/comfyui"));
    } catch (providerError) {
      setError(providerError instanceof Error ? providerError.message : "Local provider status is unavailable.");
    } finally {
      setRefreshingProvider(false);
    }
  }

  async function createImages(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!capabilities?.available || !targetId || !fullPrompt.trim() || promptTooLong) return;
    setLoading(true);
    setError("");
    setNotice("");
    const settings: Record<string, string | number> = { width, height, steps, cfg };
    if (model) settings.checkpoint = model;
    if (seed.trim()) settings.seed = Number(seed);
    try {
      await request(`${basePath}/image-jobs`, {
        method: "POST",
        body: JSON.stringify({
          branch_id: branchId,
          expected_revision: revision,
          idempotency_key: newId("image"),
          purpose: targetKind === "character" ? "portrait" : "scene",
          target_kind: targetKind,
          target_id: targetId,
          prompt: fullPrompt,
          negative_prompt: negativePrompt,
          settings,
          frame_count: frameCount,
        }),
      });
      setNotice("Added to the local image queue. Nothing will be attached until you choose Keep image.");
      setRefreshVersion((version) => version + 1);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The local image request could not be queued.");
    } finally {
      setLoading(false);
    }
  }

  async function stopQueuedFrames(jobId: string) {
    setError("");
    try {
      await request(`${basePath}/image-jobs/${encodeURIComponent(jobId)}/stop?branch_id=${encodeURIComponent(branchId)}`, {
        method: "POST",
        body: JSON.stringify({ idempotency_key: newId("image-stop") }),
      });
      setNotice("Queued frames were stopped. A frame already running in ComfyUI may finish and remain here for review.");
      setRefreshVersion((version) => version + 1);
    } catch (stopError) {
      setError(stopError instanceof Error ? stopError.message : "The image queue could not be stopped.");
    }
  }

  async function retryFrame(jobId: string, frameId: string) {
    setError("");
    try {
      await request(`${basePath}/image-jobs/${encodeURIComponent(jobId)}/frames/${encodeURIComponent(frameId)}/retry?branch_id=${encodeURIComponent(branchId)}`, {
        method: "POST",
        body: JSON.stringify({ idempotency_key: newId("image-retry") }),
      });
      setNotice("The selected frame was returned to the local queue.");
      setRefreshVersion((version) => version + 1);
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "This image frame could not be retried.");
    }
  }

  async function loadCandidate(candidateId: string) {
    if (preview?.candidateId === candidateId) {
      setPreview(null);
      return;
    }
    setError("");
    try {
      const candidate = await request<{ data_base64: string; mime_type: string }>(
        `${basePath}/image-candidates/${encodeURIComponent(candidateId)}?branch_id=${encodeURIComponent(branchId)}`,
      );
      setPreview({ candidateId, dataUrl: `data:${candidate.mime_type};base64,${candidate.data_base64}` });
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "This image could not be previewed.");
    }
  }

  async function keepCandidate(candidate: StoryImageCandidate) {
    setLoading(true);
    setError("");
    try {
      const result = await request<Record<string, unknown>>(
        `${basePath}/image-candidates/${encodeURIComponent(candidate.candidate_id)}/attach`,
        {
          method: "POST",
          body: JSON.stringify({
            branch_id: branchId,
            expected_revision: revision,
            idempotency_key: newId("image-attach"),
            display_name: candidate.target_kind === "character" ? "Generated character image" : "Generated scene image",
            reason: "Attach a reviewed local image candidate to this adventure",
          }),
        },
      );
      if (typeof result.revision === "number") onRevisionChange(result.revision);
      setNotice("Image attached to this adventure. Its prompt and generation recipe remain in image history.");
      setPreview(null);
      setRefreshVersion((version) => version + 1);
    } catch (attachError) {
      setError(attachError instanceof Error ? attachError.message : "The image could not be attached.");
    } finally {
      setLoading(false);
    }
  }

  if (!enabled) return null;

  return (
    <section className="story-image-workspace" aria-labelledby="story-image-workspace-title">
      <div className="story-image-workspace-heading">
        <div>
          <h3 id="story-image-workspace-title">Create an image</h3>
          <p>Use this adventure’s visual profile, review a local result, then choose whether to keep it.</p>
        </div>
        <button className="link-button" type="button" onClick={() => void refreshProvider()} disabled={refreshingProvider}>
          {refreshingProvider ? "Checking…" : "Refresh provider status"}
        </button>
      </div>

      <div className={`story-image-provider-status ${capabilities?.available ? "ready" : "unavailable"}`} role="status">
        <span className="story-image-provider-dot" aria-hidden="true" />
        <div>
          <strong>{capabilities?.available ? "Local ComfyUI ready" : "Local image provider unavailable"}</strong>
          <p>{capabilities?.message || "Checking the local ComfyUI service…"}</p>
        </div>
      </div>
      <p className="field-note">
        Image prompts go to the ComfyUI service on this device. Lorethra does not use a hosted fallback. Reference-image guidance, upscaling, and variations are not available in the current workflow.
      </p>

      <form className="story-image-create-form" onSubmit={(event) => void createImages(event)}>
        <label className="field-label">
          Create for
          <select value={target} onChange={(event) => setTarget(event.target.value)}>
            <optgroup label="Character portraits">
              <option value={`character:${adventure.actor_entity_id}`}>{adventure.actor_label} · hero</option>
              {npcs.map((npc) => <option key={npc.npc_entity_id} value={`character:${npc.npc_entity_id}`}>{npc.label} · NPC</option>)}
            </optgroup>
            <optgroup label="Saved scenes">
              {sceneTurns.map((turn) => <option key={turn.turn_id} value={`scene:${turn.turn_id}`}>Scene · order {turn.narrative_order}</option>)}
            </optgroup>
          </select>
        </label>

        {targetKind === "character" && profilePrompt && (
          <p className="field-note story-image-profile-note">Saved appearance and style guidance for this character will be included in the local prompt preview.</p>
        )}
        {targetKind === "character" && !profilePrompt && (
          <p className="field-note story-image-profile-note">No visual profile is saved for this character yet. Describe their visible appearance below or add a profile above.</p>
        )}
        {targetKind === "scene" && (
          <p className="field-note story-image-profile-note">Only the description you enter below is sent. Lorethra does not include hidden turns or the story transcript in an image prompt.</p>
        )}

        <label className="field-label">
          What should the image show?
          <textarea
            dir="auto"
            rows={3}
            maxLength={4000}
            value={direction}
            onChange={(event) => setDirection(event.target.value)}
            placeholder={targetKind === "scene" ? "Describe the visible scene, mood, and composition…" : "Describe pose, clothing, expression, or setting…"}
            aria-describedby="story-image-prompt-help"
          />
          <small id="story-image-prompt-help">The saved character profile is added above this direction. Keep hidden story information out of the description.</small>
        </label>
        {fullPrompt && (
          <details className="story-image-prompt-preview">
            <summary>Review exact prompt sent to ComfyUI</summary>
            <p dir="auto">{fullPrompt}</p>
          </details>
        )}
        {promptTooLong && <p className="inline-error" role="alert">The combined prompt exceeds 4,000 characters. Shorten the profile or description.</p>}

        {capabilities?.models.length === 1 ? (
          <p className="field-note story-image-model-note">Local model: <strong>{capabilities.models[0]}</strong></p>
        ) : (capabilities?.models.length ?? 0) > 1 ? (
          <label className="field-label">
            Local model
            <select value={model} onChange={(event) => setModel(event.target.value)} required>
              <option value="">Choose a model</option>
              {capabilities?.models.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        ) : null}

        <label className="field-label story-image-frame-count">
          Images to create
          <select value={frameCount} onChange={(event) => setFrameCount(Number(event.target.value))}>
            {[1, 2, 3, 4].map((count) => <option value={count} key={count}>{count} {count === 1 ? "image" : "images"}</option>)}
          </select>
          <small>Each result can succeed or fail independently.</small>
        </label>

        <details className="story-image-advanced">
          <summary>Advanced generation settings</summary>
          <div className="story-image-settings-grid">
            {capabilities?.supports.width && <label className="field-label">Width<input type="number" min={256} max={1024} step={64} value={width} onChange={(event) => setWidth(Number(event.target.value))} /></label>}
            {capabilities?.supports.height && <label className="field-label">Height<input type="number" min={256} max={1024} step={64} value={height} onChange={(event) => setHeight(Number(event.target.value))} /></label>}
            <label className="field-label">Steps<input type="number" min={1} max={50} value={steps} onChange={(event) => setSteps(Number(event.target.value))} /></label>
            <label className="field-label">Guidance<input type="number" min={1} max={20} step={0.5} value={cfg} onChange={(event) => setCfg(Number(event.target.value))} /></label>
            {capabilities?.supports.seed && <label className="field-label">Seed (optional)<input type="number" min={0} max={4294967295} value={seed} onChange={(event) => setSeed(event.target.value)} placeholder="Random" /></label>}
            {capabilities?.supports.negative_prompt && <label className="field-label story-image-negative-prompt">Avoid in the image<textarea dir="auto" rows={2} maxLength={1000} value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)} placeholder="Optional details to avoid…" /></label>}
          </div>
          <p className="field-note">These controls match the installed workflow. Reusing a seed can help reproduce compatible settings, but does not guarantee the same face or result.</p>
        </details>

        <button className="primary-button" type="submit" disabled={loading || !capabilities?.available || !fullPrompt.trim() || promptTooLong || (capabilities.models.length > 1 && !model)}>
          {loading ? "Adding to queue…" : `Create ${frameCount === 1 ? "image" : `${frameCount} images`}`}
        </button>
      </form>

      {notice && <p className="story-image-notice" role="status">{notice}</p>}
      {error && <p className="inline-error" role="alert">{error}</p>}

      <section className="story-image-history" aria-labelledby="story-image-history-title">
        <div className="story-image-subheading">
          <h4 id="story-image-history-title">Generation history</h4>
          <span>{jobs.length} {jobs.length === 1 ? "request" : "requests"}</span>
        </div>
        {jobs.length ? (
          <ol className="story-image-job-list">
            {jobs.map((job) => (
              <li className="story-image-job" key={job.job_id}>
                <div className="story-image-job-heading">
                  <strong>{job.purpose === "portrait" ? "Character portrait" : "Scene image"}</strong>
                  <span className={`story-image-status status-${job.status}`}>{job.status}</span>
                </div>
                <small>{job.frame_count} {job.frame_count === 1 ? "image" : "images"} · saved from revision {job.source_revision}</small>
                {job.stop_requested && <p className="field-note">Queued frames have stopped. A running ComfyUI request may still finish.</p>}
                <ol className="story-image-frame-list">
                  {job.frames.map((frame) => (
                    <li key={frame.frame_id}>
                      <span>Image {frame.frame_number} · {frame.status}</span>
                      {frame.candidate_id && <small>Ready for review below</small>}
                      {frame.error_message && <small className="story-image-frame-error">{frame.error_message}</small>}
                      {["failed", "interrupted", "cancelled"].includes(frame.status) && (
                        <button className="link-button" type="button" onClick={() => void retryFrame(job.job_id, frame.frame_id)}>Retry this image</button>
                      )}
                    </li>
                  ))}
                </ol>
                {["queued", "running"].includes(job.status) && (
                  <button className="secondary-button" type="button" onClick={() => void stopQueuedFrames(job.job_id)}>Stop queued images</button>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty-hint">Your image requests and their individual results will appear here.</p>
        )}
        {hasActiveJobs && <p className="field-note" aria-live="polite">Checking local image progress…</p>}
      </section>

      <section className="story-image-results" aria-labelledby="story-image-results-title">
        <div className="story-image-subheading">
          <h4 id="story-image-results-title">Results to review</h4>
          <span>{candidates.length} {candidates.length === 1 ? "candidate" : "candidates"}</span>
        </div>
        {candidates.length ? (
          <ul className="story-image-candidate-list">
            {candidates.map((candidate) => (
              <li className="story-image-candidate" key={candidate.candidate_id}>
                <div>
                  <strong>{candidate.target_kind === "character" ? "Character image" : "Scene image"}</strong>
                  <small>{String(candidate.recipe.model || "Local model")} · seed {String(candidate.recipe.seed ?? "unknown")} · {candidate.size_bytes.toLocaleString()} bytes</small>
                  <small>Recipe saved · {new Date(candidate.created_at).toLocaleString()}</small>
                </div>
                <div className="story-image-candidate-actions">
                  <button className="secondary-button" type="button" onClick={() => void loadCandidate(candidate.candidate_id)}>
                    {preview?.candidateId === candidate.candidate_id ? "Hide preview" : "Preview"}
                  </button>
                  <button className="primary-button" type="button" disabled={loading || Boolean(candidate.attached_asset_id)} onClick={() => void keepCandidate(candidate)}>
                    {candidate.attached_asset_id ? "Kept in adventure" : "Keep image"}
                  </button>
                </div>
                {preview?.candidateId === candidate.candidate_id && <img className="story-image-candidate-preview" src={preview.dataUrl} alt={`${candidate.target_kind === "character" ? "Character" : "Scene"} image candidate preview`} />}
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-hint">Generated images stay unselected until you preview and keep one.</p>
        )}
      </section>
    </section>
  );
}

export const StoryImageWorkspace = memo(StoryImageWorkspaceView);
