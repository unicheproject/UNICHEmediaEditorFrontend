import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { api } from "@/lib/api";
import { useWorkspaceStore } from "@/stores/workspace";
import type { AgentPlan } from "@/types/api";

const TERMINAL_STATUSES = new Set(["succeeded", "failed"]);

export type ChatEntry =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "plan"; plan: AgentPlan };

export const useAgentChatStore = defineStore("agentChat", () => {
  const workspace = useWorkspaceStore();

  const open = ref(false);
  const sessionId = ref<string | null>(null);
  const scopeAssetIds = ref<string[]>([]);
  const messages = ref<ChatEntry[]>([]);
  const creatingSession = ref(false);
  const sending = ref(false);
  const approving = ref(false);
  const error = ref<string | null>(null);
  // Set when a plan reaches a terminal state: the next message sent starts a
  // fresh session (rescoped to the current selection) and clears the transcript.
  const pendingReset = ref(false);

  let pollTimer: number | null = null;

  const currentPlan = computed<AgentPlan | null>(() => {
    for (let i = messages.value.length - 1; i >= 0; i -= 1) {
      const entry = messages.value[i];
      if (entry.kind === "plan") {
        return entry.plan;
      }
    }
    return null;
  });

  const canApprove = computed(
    () => currentPlan.value?.status === "proposed" && !approving.value,
  );

  // The active session's fixed scope, or the live selection before one exists.
  const scopeCount = computed(() =>
    sessionId.value ? scopeAssetIds.value.length : workspace.selectedAssetIds.size,
  );

  function stopPolling() {
    if (pollTimer !== null) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function updatePlan(plan: AgentPlan) {
    for (let i = messages.value.length - 1; i >= 0; i -= 1) {
      const entry = messages.value[i];
      if (entry.kind === "plan" && entry.plan.id === plan.id) {
        messages.value[i] = { kind: "plan", plan };
        return;
      }
    }
  }

  function clearSession() {
    stopPolling();
    sessionId.value = null;
    scopeAssetIds.value = [];
    messages.value = [];
    error.value = null;
    pendingReset.value = false;
  }

  // Lazily create a session scoped to the current selection. Called on first
  // send so the scope always reflects the selection at that moment.
  async function ensureSession() {
    if (sessionId.value) {
      return;
    }
    if (!workspace.selectedProjectId) {
      error.value = "Select a project before chatting with the agent.";
      return;
    }

    creatingSession.value = true;
    try {
      const assetIds = [...workspace.selectedAssetIds];
      scopeAssetIds.value = assetIds;
      const session = await api.createAgentSession({
        project_id: workspace.selectedProjectId,
        asset_ids: assetIds,
      });
      sessionId.value = session.id;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Unable to start agent session.";
    } finally {
      creatingSession.value = false;
    }
  }

  function openChat() {
    open.value = true;
    error.value = null;
  }

  function closeChat() {
    open.value = false;
  }

  function reset() {
    clearSession();
    open.value = false;
  }

  async function send(content: string) {
    const text = content.trim();
    if (!text || sending.value) {
      return;
    }

    // A finished plan ends the conversation: start fresh for the next request.
    if (pendingReset.value) {
      clearSession();
    }

    await ensureSession();
    if (!sessionId.value) {
      return;
    }

    error.value = null;
    sending.value = true;
    messages.value.push({ kind: "user", text });
    try {
      const response = await api.sendAgentMessage(sessionId.value, text);
      if (response.type === "clarification") {
        messages.value.push({
          kind: "assistant",
          text: response.question ?? "Could you clarify your request?",
        });
      } else {
        messages.value.push({ kind: "plan", plan: response.plan });
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : "The agent could not respond.";
    } finally {
      sending.value = false;
    }
  }

  async function approve() {
    const plan = currentPlan.value;
    if (!plan || plan.status !== "proposed" || approving.value) {
      return;
    }

    error.value = null;
    approving.value = true;
    try {
      const approved = await api.approveAgentPlan(plan.id);
      updatePlan(approved);
      startPolling(plan.id);
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Unable to approve the plan.";
    } finally {
      approving.value = false;
    }
  }

  function startPolling(planId: string) {
    stopPolling();

    const poll = async () => {
      try {
        const plan = await api.getAgentPlan(planId);
        updatePlan(plan);

        if (TERMINAL_STATUSES.has(plan.status)) {
          stopPolling();
          if (plan.status === "succeeded") {
            await workspace.loadProjectData();
          }
          // The plan is consumed; the next message starts a fresh, rescoped session.
          pendingReset.value = true;
        }
      } catch (err) {
        error.value = err instanceof Error ? err.message : "Unable to refresh plan status.";
      }
    };

    void poll();
    pollTimer = window.setInterval(poll, 1500);
  }

  return {
    open,
    sessionId,
    scopeAssetIds,
    scopeCount,
    messages,
    creatingSession,
    sending,
    approving,
    error,
    currentPlan,
    canApprove,
    openChat,
    closeChat,
    reset,
    send,
    approve,
  };
});
