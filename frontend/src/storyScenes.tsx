import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Entity,
  StoryAdventure,
  StoryMapLocation,
  StoryNpc,
  request,
} from "./api";
import "./story-scenes.css";

type StorySceneStatus = "draft" | "active" | "completed" | "cancelled";
type StorySceneTime =
  | { kind: "unknown" }
  | { kind: "exact"; value: string; calendar_id?: string }
  | { kind: "interval"; start: string; end: string; calendar_id?: string }
  | { kind: "relative"; offset: string; anchor: StorySceneReference };
type StorySceneReference = {
  scene_id: string;
  scene_revision: number;
  branch_id?: string;
};
type StorySceneLocationReference = {
  location_id: string;
  approved_revision: number;
  captured_name?: string;
  branch_id?: string;
} | null;
type StorySceneParticipant = {
  participant_id: string;
  entity_id: string;
  participant_kind: "protagonist" | "character" | "npc" | "background" | "other";
  role: string;
  participation_status: "planned" | "present" | "offstage" | "departed" | "mentioned";
  state_snapshot: Record<string, unknown>;
  current_location_ref: StorySceneLocationReference;
  scene_state: Record<string, unknown>;
  emotional_state: string | null;
  knowledge_scope: { scope: "shared" | "actors" | "author" | "private"; known_by: string[] };
  visual_reference_ids: string[];
};
type StorySceneInteraction = {
  interaction_id: string;
  ordinal: number;
  interaction_type: "dialogue" | "action" | "check" | "event" | "narration" | "transition" | "beat";
  record_state: "planned" | "recorded" | "voided";
  actor_participant_id?: string;
  target_participant_ids: string[];
  intent?: string;
  summary?: string;
  emotional_beat?: string;
  dialogue_refs: Array<Record<string, unknown>>;
  source_refs: Array<Record<string, unknown>>;
  action?: string;
};
type StoryScene = {
  scene_id: string;
  scene_sequence: number;
  scene_revision: number;
  title: string;
  status: StorySceneStatus;
  is_archived: boolean;
  location_ref: StorySceneLocationReference;
  in_world_time: StorySceneTime;
  intent: string;
  participants: StorySceneParticipant[];
  interactions: StorySceneInteraction[];
  created_at: string;
  source_branch_revision: number;
  memory_refs: Array<Record<string, unknown>>;
  context_manifest_ref: Record<string, unknown> | null;
  history_refs: Array<Record<string, unknown>>;
};
type StorySceneDraft = Pick<
  StoryScene,
  | "scene_sequence"
  | "title"
  | "location_ref"
  | "in_world_time"
  | "intent"
  | "participants"
  | "interactions"
  | "memory_refs"
  | "context_manifest_ref"
  | "history_refs"
>;
type StorySceneSnapshotSummary = {
  snapshot_id: string;
  scene_revision: number;
  captured_at: string;
  captured_by: string;
  payload_sha256: string;
};
type StorySceneSnapshot = {
  snapshot_id: string;
  captured_at: string;
  captured_by: string;
  captured_branch_revision: number;
  payload_sha256: string;
  payload: Record<string, unknown>;
};

const EMPTY_DRAFT: StorySceneDraft = {
  scene_sequence: 1,
  title: "",
  location_ref: null,
  in_world_time: { kind: "unknown" },
  intent: "",
  participants: [],
  interactions: [],
  memory_refs: [],
  context_manifest_ref: null,
  history_refs: [],
};

function scenePath(workspaceId: string, adventureId: string, branchId: string) {
  const query = new URLSearchParams({ branch_id: branchId });
  return `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/story/adventures/${encodeURIComponent(adventureId)}/scenes?${query}`;
}

function copySceneDraft(scene: StoryScene): StorySceneDraft {
  return {
    scene_sequence: scene.scene_sequence,
    title: scene.title,
    location_ref: structuredClone(scene.location_ref),
    in_world_time: structuredClone(scene.in_world_time),
    intent: scene.intent,
    participants: structuredClone(scene.participants),
    interactions: structuredClone(scene.interactions),
    memory_refs: structuredClone(scene.memory_refs || []),
    context_manifest_ref: structuredClone(scene.context_manifest_ref),
    history_refs: structuredClone(scene.history_refs || []),
  };
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

export function StorySceneStudio({
  workspaceId,
  branchId,
  adventure,
  entities,
  locations,
  npcs,
  busy,
  onCommit,
}: {
  workspaceId: string;
  branchId: string;
  adventure: StoryAdventure;
  entities: Entity[];
  locations: StoryMapLocation[];
  npcs: StoryNpc[];
  busy: boolean;
  onCommit: (
    branchId: string,
    command: string,
    payload: Record<string, unknown>,
    reason: string,
  ) => Promise<Record<string, unknown>>;
}) {
  const [scenes, setScenes] = useState<StoryScene[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState("");
  const [draft, setDraft] = useState<StorySceneDraft | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [snapshotList, setSnapshotList] = useState<StorySceneSnapshotSummary[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<StorySceneSnapshot | null>(null);
  const [snapshotError, setSnapshotError] = useState("");
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [participantChoice, setParticipantChoice] = useState("");

  const characters = useMemo(
    () => entities.filter((entity) => ["character", "person"].includes(entity.entity_type)),
    [entities],
  );
  const selectedScene = scenes.find((scene) => scene.scene_id === selectedSceneId) || null;

  const loadScenes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await request<{ scenes: StoryScene[] }>(
        scenePath(workspaceId, adventure.adventure_id, branchId),
      );
      setScenes(response.scenes);
      return response.scenes;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Scenes could not be loaded.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [workspaceId, branchId, adventure.adventure_id]);

  useEffect(() => {
    setSelectedSceneId("");
    setDraft(null);
    setIsCreating(false);
    setSelectedSnapshot(null);
    setSnapshotList([]);
    void loadScenes();
  }, [loadScenes]);

  useEffect(() => {
    if (!selectedSceneId || isCreating) return;
    const scene = scenes.find((item) => item.scene_id === selectedSceneId);
    if (scene) setDraft(copySceneDraft(scene));
  }, [selectedSceneId, scenes, isCreating]);

  useEffect(() => {
    if (!scenes.length) {
      if (!isCreating) setSelectedSceneId("");
      return;
    }
    if (!isCreating && !scenes.some((scene) => scene.scene_id === selectedSceneId)) {
      setSelectedSceneId(scenes[0].scene_id);
    }
  }, [scenes, selectedSceneId, isCreating]);

  const loadSnapshots = useCallback(async (sceneId: string) => {
    setLoadingSnapshots(true);
    setSnapshotError("");
    setSelectedSnapshot(null);
    try {
      const query = new URLSearchParams({ branch_id: branchId });
      const response = await request<{ snapshots: StorySceneSnapshotSummary[] }>(
        `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/story/adventures/${encodeURIComponent(adventure.adventure_id)}/scenes/${encodeURIComponent(sceneId)}/snapshots?${query}`,
      );
      setSnapshotList(response.snapshots);
    } catch (loadError) {
      setSnapshotError(loadError instanceof Error ? loadError.message : "Snapshot history could not be loaded.");
      setSnapshotList([]);
    } finally {
      setLoadingSnapshots(false);
    }
  }, [workspaceId, branchId, adventure.adventure_id]);

  useEffect(() => {
    if (!selectedSceneId || isCreating) {
      setSnapshotList([]);
      setSelectedSnapshot(null);
      return;
    }
    void loadSnapshots(selectedSceneId);
  }, [selectedSceneId, isCreating, loadSnapshots, selectedScene?.scene_revision]);

  function beginNewScene() {
    setError("");
    setNotice("");
    setSelectedSceneId("");
    setSelectedSnapshot(null);
    setIsCreating(true);
    setDraft({ ...EMPTY_DRAFT, scene_sequence: scenes.length + 1 });
  }

  function updateDraft(change: Partial<StorySceneDraft>) {
    setDraft((current) => (current ? { ...current, ...change } : current));
  }

  function addParticipant() {
    if (!draft || !participantChoice) return;
    const entity = characters.find((item) => item.entity_id === participantChoice);
    if (!entity || draft.participants.some((item) => item.entity_id === entity.entity_id)) return;
    const npc = npcs.find((item) => item.npc_entity_id === entity.entity_id);
    const participantKind: StorySceneParticipant["participant_kind"] =
      entity.entity_id === adventure.actor_entity_id
        ? "protagonist"
        : npc && npc.review_status !== "rejected"
          ? "npc"
          : "character";
    const participant: StorySceneParticipant = {
      participant_id: `participant_${crypto.randomUUID()}`,
      entity_id: entity.entity_id,
      participant_kind: participantKind,
      role: participantKind === "protagonist" ? "Protagonist" : entity.label,
      participation_status: "present",
      state_snapshot: { status: "not_captured" },
      current_location_ref: null,
      scene_state: {},
      emotional_state: null,
      knowledge_scope: { scope: "private", known_by: [] },
      visual_reference_ids: [],
    };
    updateDraft({ participants: [...draft.participants, participant] });
    setParticipantChoice("");
  }

  function updateParticipant(participantId: string, change: Partial<StorySceneParticipant>) {
    if (!draft) return;
    updateDraft({
      participants: draft.participants.map((item) =>
        item.participant_id === participantId ? { ...item, ...change } : item,
      ),
    });
  }

  function removeParticipant(participantId: string) {
    if (!draft) return;
    updateDraft({
      participants: draft.participants.filter((item) => item.participant_id !== participantId),
      interactions: draft.interactions.map((item) => ({
        ...item,
        actor_participant_id: item.actor_participant_id === participantId
          ? undefined
          : item.actor_participant_id,
        target_participant_ids: item.target_participant_ids.filter((id) => id !== participantId),
      })),
    });
  }

  function addInteraction() {
    if (!draft) return;
    const next: StorySceneInteraction = {
      interaction_id: `interaction_${crypto.randomUUID()}`,
      ordinal: draft.interactions.length + 1,
      interaction_type: "beat",
      record_state: "planned",
      actor_participant_id: draft.participants[0]?.participant_id,
      target_participant_ids: [],
      summary: "",
      intent: "",
      emotional_beat: "",
      dialogue_refs: [],
      source_refs: [],
    };
    updateDraft({ interactions: [...draft.interactions, next] });
  }

  function updateInteraction(interactionId: string, change: Partial<StorySceneInteraction>) {
    if (!draft) return;
    updateDraft({
      interactions: draft.interactions.map((item) =>
        item.interaction_id === interactionId ? { ...item, ...change } : item,
      ),
    });
  }

  function moveInteraction(index: number, offset: -1 | 1) {
    if (!draft) return;
    const target = index + offset;
    if (target < 0 || target >= draft.interactions.length) return;
    const interactions = [...draft.interactions];
    [interactions[index], interactions[target]] = [interactions[target], interactions[index]];
    updateDraft({ interactions: interactions.map((item, order) => ({ ...item, ordinal: order + 1 })) });
  }

  async function saveScene(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    setError("");
    setNotice("");
    const title = draft.title.trim();
    if (!title) {
      setError("Add a title before saving this scene.");
      return;
    }
    if (draft.interactions.some((item) => item.interaction_type === "action" && !item.action?.trim())) {
      setError("Each action beat needs an action description.");
      return;
    }
    const payload = {
      adventure_id: adventure.adventure_id,
      scene: {
        ...draft,
        title,
        intent: draft.intent.trim(),
        interactions: draft.interactions.map((item, index) => ({ ...item, ordinal: index + 1 })),
      },
    };
    try {
      const result = await onCommit(
        branchId,
        "create_story_scene",
        payload,
        "Create a scene in Scene Studio",
      );
      const newSceneId = typeof result.scene_id === "string" ? result.scene_id : "";
      const updatedScenes = await loadScenes();
      if (newSceneId) setSelectedSceneId(newSceneId);
      else if (updatedScenes?.length) setSelectedSceneId(updatedScenes[0].scene_id);
      setIsCreating(false);
      setDraft(null);
      setNotice("Scene created. It remains a draft until you change its status.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Scene could not be created.");
    }
  }

  async function saveChanges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || !selectedScene) return;
    setError("");
    setNotice("");
    const title = draft.title.trim();
    if (!title) {
      setError("Add a title before saving this scene.");
      return;
    }
    if (draft.interactions.some((item) => item.interaction_type === "action" && !item.action?.trim())) {
      setError("Each action beat needs an action description.");
      return;
    }
    try {
      await onCommit(
        branchId,
        "revise_story_scene",
        {
          adventure_id: adventure.adventure_id,
          scene_id: selectedScene.scene_id,
          expected_scene_revision: selectedScene.scene_revision,
          changes: {
            ...draft,
            title,
            intent: draft.intent.trim(),
            interactions: draft.interactions.map((item, index) => ({ ...item, ordinal: index + 1 })),
          },
        },
        "Edit a scene in Scene Studio",
      );
      const updatedScenes = await loadScenes();
      const updatedScene = updatedScenes?.find((scene) => scene.scene_id === selectedScene.scene_id);
      if (updatedScene) setDraft(copySceneDraft(updatedScene));
      setNotice("Scene changes saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Scene could not be saved.");
    }
  }

  async function changeStatus(status: "active" | "completed" | "cancelled" | "reopen") {
    if (!selectedScene) return;
    setError("");
    setNotice("");
    const command = status === "reopen" ? "reopen_story_scene" : "set_story_scene_status";
    const commandPayload: Record<string, unknown> = {
      adventure_id: adventure.adventure_id,
      scene_id: selectedScene.scene_id,
      expected_scene_revision: selectedScene.scene_revision,
    };
    if (status !== "reopen") commandPayload.status = status;
    try {
      await onCommit(branchId, command, commandPayload, `Change scene status to ${status}`);
      await loadScenes();
      setNotice(status === "completed" ? "Scene completed and a snapshot was captured." : "Scene status updated.");
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Scene status could not be changed.");
    }
  }

  async function toggleArchived() {
    if (!selectedScene) return;
    setError("");
    try {
      await onCommit(
        branchId,
        "set_story_scene_archived",
        {
          adventure_id: adventure.adventure_id,
          scene_id: selectedScene.scene_id,
          expected_scene_revision: selectedScene.scene_revision,
          archived: !selectedScene.is_archived,
        },
        selectedScene.is_archived ? "Restore an archived scene" : "Archive a completed scene",
      );
      await loadScenes();
      setNotice(selectedScene.is_archived ? "Scene restored." : "Scene archived.");
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Scene could not be archived.");
    }
  }

  async function captureSnapshot() {
    if (!selectedScene) return;
    setError("");
    try {
      await onCommit(
        branchId,
        "create_story_scene_snapshot",
        {
          adventure_id: adventure.adventure_id,
          scene_id: selectedScene.scene_id,
          scene_revision: selectedScene.scene_revision,
        },
        "Capture a scene revision snapshot",
      );
      await loadSnapshots(selectedScene.scene_id);
      setNotice("Scene revision snapshot captured.");
    } catch (snapshotFailure) {
      setError(snapshotFailure instanceof Error ? snapshotFailure.message : "Snapshot could not be captured.");
    }
  }

  async function inspectSnapshot(snapshotId: string) {
    if (!selectedScene) return;
    setSnapshotError("");
    setSelectedSnapshot(null);
    const query = new URLSearchParams({ branch_id: branchId });
    try {
      const snapshot = await request<StorySceneSnapshot>(
        `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/story/adventures/${encodeURIComponent(adventure.adventure_id)}/scenes/${encodeURIComponent(selectedScene.scene_id)}/snapshots/${encodeURIComponent(snapshotId)}?${query}`,
      );
      setSelectedSnapshot(snapshot);
    } catch (detailError) {
      setSnapshotError(detailError instanceof Error ? detailError.message : "Snapshot details could not be loaded.");
    }
  }

  function cancelCreate() {
    setDraft(null);
    setIsCreating(false);
    setError("");
    setSelectedSceneId(scenes[0]?.scene_id || "");
  }

  return (
    <div className="story-scene-studio">
      <header className="story-scene-header">
        <div>
          <span className="story-scene-eyebrow">Scene Studio</span>
          <h2>Scenes in {adventure.name}</h2>
          <p>Define the setting, cast, and ordered beats for this adventure.</p>
        </div>
        <button className="primary-button" type="button" disabled={busy} onClick={beginNewScene}>
          New scene
        </button>
      </header>

      {(error || notice) && (
        <p className={error ? "story-scene-message is-error" : "story-scene-message"}
          role={error ? "alert" : "status"} aria-live="polite">
          {error || notice}
        </p>
      )}

      <div className="story-scene-workspace">
        <aside className="story-scene-list" aria-label="Adventure scenes">
          <div className="story-scene-list-heading">
            <h3>Scene list</h3>
            <span>{scenes.length}</span>
          </div>
          {loading ? (
            <p className="story-scene-empty" role="status">Loading scenes…</p>
          ) : scenes.length ? (
            <ul>
              {scenes.map((scene) => (
                <li key={scene.scene_id}>
                  <button
                    type="button"
                    className={scene.scene_id === selectedSceneId && !isCreating ? "is-selected" : ""}
                    aria-pressed={scene.scene_id === selectedSceneId && !isCreating}
                    onClick={() => {
                      setIsCreating(false);
                      setSelectedSceneId(scene.scene_id);
                      setError("");
                      setNotice("");
                    }}
                  >
                    <span className="story-scene-list-row">
                      <strong>{scene.title}</strong>
                      <span className={`story-scene-status status-${scene.status}`}>{scene.status}</span>
                    </span>
                    <small>Scene {scene.scene_sequence} · v{scene.scene_revision}{scene.is_archived ? " · archived" : ""}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="story-scene-empty">No scenes yet. Start with a location, a cast member, or a single beat.</p>
          )}
        </aside>

        <section className="story-scene-editor" aria-label={isCreating ? "New scene details" : "Scene details"}>
          {!draft ? (
            <div className="story-scene-empty-state">
              <h3>Select a scene to inspect</h3>
              <p>Scene details, participants, the interaction order, and saved snapshots appear here.</p>
              <button className="secondary-button" type="button" onClick={beginNewScene}>Create a scene</button>
            </div>
          ) : (
            <>
              {!isCreating && selectedScene && (
                <div className="story-scene-detail-meta">
                  <span className={`story-scene-status status-${selectedScene.status}`}>{selectedScene.status}</span>
                  <span>Revision {selectedScene.scene_revision}</span>
                  <span>Saved {formatDate(selectedScene.created_at)}</span>
                </div>
              )}
              <form onSubmit={isCreating ? saveScene : saveChanges}>
                <div className="story-scene-fields">
                  <label className="field-label">
                    Scene title
                    <input maxLength={200} required value={draft.title}
                      onChange={(event) => updateDraft({ title: event.currentTarget.value })}
                      placeholder="The lantern at the harbor gate" />
                  </label>
                  <label className="field-label">
                    Location
                    <select
                      value={draft.location_ref?.location_id || ""}
                      onChange={(event) => {
                        const location = locations.find((item) => item.location_id === event.currentTarget.value);
                        updateDraft({ location_ref: location ? {
                          location_id: location.location_id,
                          approved_revision: location.reviewed_revision ?? location.created_revision,
                          captured_name: location.name,
                        } : null });
                      }}
                    >
                      <option value="">No location selected</option>
                      {locations.filter((item) => (item.effective_status || item.status) === "approved").map((location) => (
                        <option key={location.location_id} value={location.location_id}>{location.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field-label story-scene-intent">
                    Scene intent
                    <textarea maxLength={4000} rows={3} value={draft.intent}
                      onChange={(event) => updateDraft({ intent: event.currentTarget.value })}
                      placeholder="What should this scene establish or change?" />
                  </label>
                </div>

                <section className="story-scene-section" aria-labelledby="story-scene-participants-title">
                  <div className="story-scene-section-heading">
                    <div><h3 id="story-scene-participants-title">Participants</h3><p>Choose characters already in this adventure branch.</p></div>
                    <span>{draft.participants.length}</span>
                  </div>
                  <div className="story-scene-add-participant">
                    <label className="field-label" htmlFor="story-scene-participant-choice">Add character or NPC</label>
                    <div>
                      <select id="story-scene-participant-choice" value={participantChoice}
                        onChange={(event) => setParticipantChoice(event.currentTarget.value)}>
                        <option value="">Choose a character</option>
                        {characters.filter((entity) => !draft.participants.some((item) => item.entity_id === entity.entity_id)).map((entity) => (
                          <option key={entity.entity_id} value={entity.entity_id}>
                            {entity.label}{entity.entity_id === adventure.actor_entity_id ? " · protagonist" : npcs.some((npc) => npc.npc_entity_id === entity.entity_id && npc.review_status !== "rejected") ? " · NPC" : ""}
                          </option>
                        ))}
                      </select>
                      <button className="secondary-button" type="button" disabled={!participantChoice || busy} onClick={addParticipant}>Add</button>
                    </div>
                  </div>
                  {draft.participants.length ? (
                    <ul className="story-scene-participants">
                      {draft.participants.map((participant) => {
                        const entity = characters.find((item) => item.entity_id === participant.entity_id);
                        return (
                          <li key={participant.participant_id}>
                            <div className="story-scene-participant-name"><strong>{entity?.label || participant.entity_id}</strong><small>{participant.participant_kind}</small></div>
                            <label className="field-label">Role<input maxLength={200} value={participant.role}
                              onChange={(event) => updateParticipant(participant.participant_id, { role: event.currentTarget.value })} /></label>
                            <label className="field-label">Presence<select value={participant.participation_status}
                              onChange={(event) => updateParticipant(participant.participant_id, { participation_status: event.currentTarget.value as StorySceneParticipant["participation_status"] })}>
                              <option value="planned">Planned</option><option value="present">Present</option><option value="offstage">Offstage</option><option value="departed">Departed</option><option value="mentioned">Mentioned</option>
                            </select></label>
                            <button className="quiet-button" type="button" aria-label={`Remove ${entity?.label || participant.role} from scene`}
                              onClick={() => removeParticipant(participant.participant_id)}>Remove</button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : <p className="story-scene-empty">This scene has no assigned participants yet.</p>}
                </section>

                <section className="story-scene-section" aria-labelledby="story-scene-timeline-title">
                  <div className="story-scene-section-heading">
                    <div><h3 id="story-scene-timeline-title">Interaction timeline</h3><p>Move beats to set their story order.</p></div>
                    <button className="secondary-button" type="button" onClick={addInteraction}>Add beat</button>
                  </div>
                  {draft.interactions.length ? (
                    <ol className="story-scene-timeline">
                      {draft.interactions.map((interaction, index) => (
                        <li key={interaction.interaction_id}>
                          <span className="story-scene-ordinal" aria-label={`Beat ${index + 1}`}>{String(index + 1).padStart(2, "0")}</span>
                          <div className="story-scene-beat-content">
                            <div className="story-scene-beat-fields">
                              <label className="field-label">Beat type<select value={interaction.interaction_type}
                                onChange={(event) => updateInteraction(interaction.interaction_id, { interaction_type: event.currentTarget.value as StorySceneInteraction["interaction_type"] })}>
                                <option value="beat">Story beat</option><option value="action">Action</option><option value="dialogue">Dialogue</option><option value="event">Event</option><option value="narration">Narration</option><option value="transition">Transition</option><option value="check">Check</option>
                              </select></label>
                              <label className="field-label">Actor<select value={interaction.actor_participant_id || ""}
                                onChange={(event) => updateInteraction(interaction.interaction_id, { actor_participant_id: event.currentTarget.value || undefined })}>
                                <option value="">No actor</option>{draft.participants.map((item) => <option key={item.participant_id} value={item.participant_id}>{item.role || item.entity_id}</option>)}
                              </select></label>
                              <label className="field-label">Summary<input maxLength={1000} value={interaction.summary || ""}
                                onChange={(event) => updateInteraction(interaction.interaction_id, { summary: event.currentTarget.value })}
                                placeholder="A short description of this beat" /></label>
                              <label className="field-label">Intent<input maxLength={4000} value={interaction.intent || ""}
                                onChange={(event) => updateInteraction(interaction.interaction_id, { intent: event.currentTarget.value })}
                                placeholder="Why does this beat happen?" /></label>
                              <label className="field-label">Emotional beat<input maxLength={1000} value={interaction.emotional_beat || ""}
                                onChange={(event) => updateInteraction(interaction.interaction_id, { emotional_beat: event.currentTarget.value })}
                                placeholder="The emotional shift" /></label>
                              {interaction.interaction_type === "action" && <label className="field-label">Action<input maxLength={1000} required value={interaction.action || ""}
                                onChange={(event) => updateInteraction(interaction.interaction_id, { action: event.currentTarget.value })}
                                placeholder="What happens?" /></label>}
                              <fieldset className="story-scene-targets">
                                <legend>Targets</legend>
                                {draft.participants.length ? draft.participants.map((participant) => (
                                  <label key={participant.participant_id}>
                                    <input type="checkbox" checked={interaction.target_participant_ids.includes(participant.participant_id)}
                                      onChange={(event) => updateInteraction(interaction.interaction_id, {
                                        target_participant_ids: event.currentTarget.checked
                                          ? [...interaction.target_participant_ids, participant.participant_id]
                                          : interaction.target_participant_ids.filter((id) => id !== participant.participant_id),
                                      })} />
                                    <span>{participant.role || participant.entity_id}</span>
                                  </label>
                                )) : <small>Add participants to assign targets.</small>}
                              </fieldset>
                            </div>
                          </div>
                          <div className="story-scene-beat-controls" aria-label={`Reorder beat ${index + 1}`}>
                            <button className="quiet-button" type="button" disabled={index === 0} aria-label="Move beat earlier" onClick={() => moveInteraction(index, -1)}>↑</button>
                            <button className="quiet-button" type="button" disabled={index === draft.interactions.length - 1} aria-label="Move beat later" onClick={() => moveInteraction(index, 1)}>↓</button>
                            <button className="quiet-button" type="button" aria-label="Remove beat" onClick={() => updateDraft({ interactions: draft.interactions.filter((item) => item.interaction_id !== interaction.interaction_id).map((item, order) => ({ ...item, ordinal: order + 1 })) })}>×</button>
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : <p className="story-scene-empty">No interactions yet. Add a beat when you are ready to shape the scene.</p>}
                </section>

                <div className="story-scene-form-actions">
                  {isCreating ? (
                    <><button className="primary-button" type="submit" disabled={busy}>Create scene</button><button className="secondary-button" type="button" onClick={cancelCreate}>Cancel</button></>
                  ) : (
                    <button className="primary-button" type="submit" disabled={busy || !selectedScene || selectedScene.is_archived}>Save changes</button>
                  )}
                </div>
              </form>

              {!isCreating && selectedScene && (
                <>
                  <section className="story-scene-section story-scene-lifecycle" aria-labelledby="story-scene-status-title">
                    <div className="story-scene-section-heading"><div><h3 id="story-scene-status-title">Scene status</h3><p>Status changes are revisioned. Completion captures a snapshot.</p></div></div>
                    <div className="story-scene-lifecycle-actions">
                      {selectedScene.status === "draft" && <><button className="secondary-button" type="button" disabled={busy} onClick={() => void changeStatus("active")}>Activate</button><button className="quiet-button" type="button" disabled={busy} onClick={() => void changeStatus("cancelled")}>Cancel scene</button></>}
                      {selectedScene.status === "active" && <><button className="primary-button" type="button" disabled={busy} onClick={() => void changeStatus("completed")}>Complete scene</button><button className="quiet-button" type="button" disabled={busy} onClick={() => void changeStatus("cancelled")}>Cancel scene</button></>}
                      {selectedScene.status === "completed" && <button className="secondary-button" type="button" disabled={busy || selectedScene.is_archived} onClick={() => void changeStatus("reopen")}>Reopen scene</button>}
                      {(selectedScene.status === "completed" || selectedScene.status === "cancelled") && <button className="quiet-button" type="button" disabled={busy} onClick={() => void toggleArchived()}>{selectedScene.is_archived ? "Restore scene" : "Archive scene"}</button>}
                    </div>
                  </section>

                  <section className="story-scene-section" aria-labelledby="story-scene-snapshots-title">
                    <div className="story-scene-section-heading"><div><h3 id="story-scene-snapshots-title">Snapshot history</h3><p>Immutable snapshots preserve an exact scene revision and its references.</p></div><button className="secondary-button" type="button" disabled={busy} onClick={() => void captureSnapshot()}>Capture revision</button></div>
                    {snapshotError && <p className="story-scene-message is-error" role="alert">{snapshotError}</p>}
                    {loadingSnapshots ? <p className="story-scene-empty" role="status">Loading snapshot history…</p> : snapshotList.length ? (
                      <ul className="story-scene-snapshots">
                        {snapshotList.map((snapshot) => (
                          <li key={snapshot.snapshot_id}>
                            <button type="button" className={selectedSnapshot?.snapshot_id === snapshot.snapshot_id ? "is-selected" : ""}
                              aria-pressed={selectedSnapshot?.snapshot_id === snapshot.snapshot_id}
                              onClick={() => void inspectSnapshot(snapshot.snapshot_id)}>
                              <strong>Scene revision {snapshot.scene_revision}</strong><small>{formatDate(snapshot.captured_at)} · {snapshot.captured_by}</small>
                              <code>{snapshot.payload_sha256.slice(0, 16)}…</code>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="story-scene-empty">No snapshots yet. Completing the scene captures one automatically.</p>}
                    {selectedSnapshot && <div className="story-scene-snapshot-detail" aria-live="polite">
                      <strong>Snapshot details</strong>
                      <dl><div><dt>Captured by</dt><dd>{selectedSnapshot.captured_by}</dd></div><div><dt>Captured</dt><dd>{formatDate(selectedSnapshot.captured_at)}</dd></div><div><dt>Branch revision</dt><dd>{selectedSnapshot.captured_branch_revision}</dd></div><div><dt>Payload SHA-256</dt><dd><code>{selectedSnapshot.payload_sha256}</code></dd></div></dl>
                    </div>}
                  </section>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
