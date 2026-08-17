<script setup lang="ts">
import { computed, ref, watch } from "vue";

import ActionDialog from "@/components/ActionDialog.vue";
import AgentChatPanel from "@/components/AgentChatPanel.vue";
import Badge from "@/components/ui/Badge.vue";
import Card from "@/components/ui/Card.vue";
import {
  actionGroupOrder,
  agentPresentation,
  presentationFor,
  type ActionGroup,
} from "@/lib/capabilityPresentation";
import {
  agentAction,
  costLabel,
  hasAssetIdsInput,
  isAgentAction,
  unavailableReason,
  type ActionOption,
} from "@/lib/capabilities";
import { useAgentChatStore } from "@/stores/agentChat";
import { useWorkspaceStore, type TranscribeResult } from "@/stores/workspace";
import type { Capability } from "@/types/api";

const store = useWorkspaceStore();
const agentChat = useAgentChatStore();
const dialogOpen = ref(false);
const selectedAction = ref<Capability | null>(null);
const creating = ref(false);
const transcribing = ref(false);
const transcriptResult = ref<TranscribeResult | null>(null);
const hoveredAction = ref<ActionOption | null>(null);
const tooltipStyle = ref<Record<string, string>>({});

const tooltipWidth = 288;
const tooltipGap = 12;
const viewportMargin = 16;

// Inapplicable actions stay visible but disabled (with a reason) rather than
// being hidden, so the panel always shows the full set of capabilities.
const availableActions = computed<ActionOption[]>(() => {
  const capabilities = store.capabilities
    .filter((capability) => capability.id !== "video.compose")
    .sort((left, right) => {
      const leftPresentation = presentationFor(left);
      const rightPresentation = presentationFor(right);
      return (
        actionGroupOrder(leftPresentation.group) - actionGroupOrder(rightPresentation.group) ||
        leftPresentation.order - rightPresentation.order ||
        left.title.localeCompare(right.title)
      );
    });
  if (store.selectedAssets.length === 0) {
    return capabilities;
  }
  return [...capabilities, agentAction];
});

const applicableActionCount = computed(
  () => availableActions.value.filter((action) => !reasonFor(action)).length,
);

function reasonFor(action: ActionOption): string | null {
  if (isAgentAction(action)) {
    return null;
  }
  return unavailableReason(action, store.selectedAssets);
}

const groupedActions = computed(() => {
  const groups = new Map<ActionGroup, ActionOption[]>();

  availableActions.value.forEach((action) => {
    const group = isAgentAction(action)
      ? agentPresentation.group
      : presentationFor(action).group;
    groups.set(group, [...(groups.get(group) ?? []), action]);
  });

  return [...groups.entries()].sort(
    ([left], [right]) => actionGroupOrder(left) - actionGroupOrder(right),
  );
});

function iconFor(action: ActionOption) {
  return isAgentAction(action) ? agentPresentation.icon : presentationFor(action).icon;
}

function openAction(action: ActionOption) {
  if (reasonFor(action)) {
    return;
  }
  if (isAgentAction(action)) {
    void agentChat.openChat();
    return;
  }
  selectedAction.value = action;
  dialogOpen.value = true;
  transcribing.value = false;
  transcriptResult.value = null;
}

function closeDialog() {
  dialogOpen.value = false;
  selectedAction.value = null;
  store.clearShotDetectResult();
  transcribing.value = false;
  transcriptResult.value = null;
}

watch(
  () => store.shotDetectResult,
  (result) => {
    if (!result) {
      return;
    }
    const asset = store.assets.find((candidate) => candidate.id === result.assetId);
    const splitCapability = store.capabilities.find((capability) => capability.id === "video.split");
    if (asset && splitCapability) {
      store.clearSelection();
      store.toggleAsset(asset.id);
      selectedAction.value = splitCapability;
      dialogOpen.value = true;
    } else {
      store.clearShotDetectResult();
    }
  },
);

watch(
  () => store.transcribeResult,
  (result) => {
    if (!result || !dialogOpen.value || selectedAction.value?.id !== "audio.transcribe") {
      return;
    }
    transcribing.value = false;
    transcriptResult.value = result;
    store.clearTranscribeResult();
  },
);

function showTooltip(action: ActionOption, event: MouseEvent | FocusEvent) {
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const leftSide = rect.left - tooltipWidth - tooltipGap;
  const rightSide = rect.right + tooltipGap;
  const left =
    leftSide >= viewportMargin
      ? leftSide
      : Math.min(rightSide, window.innerWidth - tooltipWidth - viewportMargin);
  const top = Math.min(
    Math.max(viewportMargin, rect.top + rect.height / 2 - 64),
    window.innerHeight - 176,
  );

  hoveredAction.value = action;
  tooltipStyle.value = {
    left: `${Math.max(viewportMargin, left)}px`,
    top: `${top}px`,
    width: `${tooltipWidth}px`,
  };
}

function hideTooltip() {
  hoveredAction.value = null;
}

async function submitAction(params: Record<string, unknown>) {
  if (!selectedAction.value) {
    return;
  }

  creating.value = true;
  try {
    const selectedIds = store.selectedAssets.map((asset) => asset.id);
    const input = { ...params };
    const payload: {
      capability_id: string;
      asset_id?: string;
      input: Record<string, unknown>;
    } = {
      capability_id: selectedAction.value.id,
      input,
    };

    if (selectedAction.value.id === "video.subtitle.embed" || selectedAction.value.id === "audio.mix") {
      payload.asset_id = input.video_asset_id as string;
      delete input.video_asset_id;
    } else if (hasAssetIdsInput(selectedAction.value)) {
      payload.input.asset_ids = selectedIds;
    } else {
      payload.asset_id = selectedIds[0];
    }

    await store.createJob(payload);
    if (selectedAction.value.id === "audio.transcribe") {
      transcribing.value = true;
    } else {
      closeDialog();
    }
  } catch (err) {
    store.setError(err instanceof Error ? err.message : "Unable to create job");
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <Card class="flex min-h-0 flex-col p-4 border-accent-top">
    <div class="mb-3 flex items-start justify-between gap-3">
      <div>
        <h4>Actions</h4>
        <!-- <p class="text-muted-foreground text-xs">
          {{ store.selectedAssets.length }} selected
        </p> -->
      </div>
      <Badge v-if="availableActions.length" variant="outline">
        {{ applicableActionCount }} available
      </Badge>
    </div>

    <div v-if="availableActions.length === 0" class="rounded-md border border-dashed p-4">
      <p class="text-muted-foreground">No actions available yet.</p>
    </div>

    <div v-else class="space-y-4 overflow-auto pr-1" @scroll="hideTooltip">
      <section v-for="[group, actions] in groupedActions" :key="group" class="space-y-2">
        <div class="flex items-center justify-between gap-2">
          <p class="uppercase tracking-wide text-muted-foreground font-bold text-xs">
            {{ group }}
          </p>
          <div class="h-px flex-1 bg-border" />
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            v-for="action in actions"
            :key="action.id"
            class="flex gap-1.5 border bg-background px-3 py-1.5 text-muted-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-background disabled:hover:text-muted-foreground"
            :class="reasonFor(action) ? 'flex-col items-start rounded-xl' : 'items-center rounded-[999px]'"
            type="button"
            :aria-label="action.title"
            :disabled="!isAgentAction(action) && (creating || !!reasonFor(action))"
            @blur="hideTooltip"
            @click="openAction(action)"
            @focus="showTooltip(action, $event)"
            @mouseenter="showTooltip(action, $event)"
            @mouseleave="hideTooltip"
          >
            <span class="flex items-center gap-1.5">
              <component :is="iconFor(action)" class="h-4 w-4 shrink-0" />
              <span class="whitespace-nowrap text-xs">{{ action.title }}</span>
            </span>
            <span v-if="reasonFor(action)" class="whitespace-nowrap text-[10px] opacity-80">
              {{ reasonFor(action) }}
            </span>
          </button>
        </div>
      </section>
    </div>
  </Card>

  <Teleport to="body">
    <div
      v-if="hoveredAction"
      class="pointer-events-none fixed z-[100] rounded-lg border bg-popover p-3 text-popover-foreground shadow-xl"
      :style="tooltipStyle"
      role="tooltip"
    >
      <div class="mb-2 flex flex-wrap items-center gap-2">
        <p class="font-bold">{{ hoveredAction.title }}</p>
        <Badge v-if="isAgentAction(hoveredAction)" variant="featured">Chat</Badge>
        <Badge v-else variant="default">{{ costLabel(hoveredAction.cost_class) }}</Badge>
        <Badge
          v-if="!isAgentAction(hoveredAction) && hasAssetIdsInput(hoveredAction)"
          variant="outline"
        >
          Multi
        </Badge>
      </div>
      <p class="leading-5 text-muted-foreground text-xs">
        {{ hoveredAction.description }}
      </p>
      <p v-if="!isAgentAction(hoveredAction)" class="border-t border-border mt-2 text-muted-foreground text-[10px]">
        {{ hoveredAction.supported_media_types.join(", ") }}
      </p>
    </div>
  </Teleport>

  <ActionDialog
    :open="dialogOpen"
    :action="selectedAction"
    :transcribing="transcribing"
    :transcript-result="transcriptResult"
    @close="closeDialog"
    @submit="submitAction"
  />

  <AgentChatPanel />
</template>
