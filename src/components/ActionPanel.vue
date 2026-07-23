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
  supportsSelection,
  type ActionOption,
} from "@/lib/capabilities";
import { useAgentChatStore } from "@/stores/agentChat";
import { useWorkspaceStore } from "@/stores/workspace";
import type { Capability } from "@/types/api";

const store = useWorkspaceStore();
const agentChat = useAgentChatStore();
const dialogOpen = ref(false);
const selectedAction = ref<Capability | null>(null);
const creating = ref(false);
const hoveredAction = ref<ActionOption | null>(null);
const tooltipStyle = ref<Record<string, string>>({});

const tooltipWidth = 288;
const tooltipGap = 12;
const viewportMargin = 16;

const availableActions = computed<ActionOption[]>(() => {
  if (store.selectedAssets.length === 0) {
    return [];
  }
  const capabilities = store.capabilities
    .filter(
      (capability) =>
        capability.id !== "video.compose" &&
        supportsSelection(capability, store.selectedAssets),
    )
    .sort((left, right) => {
      const leftPresentation = presentationFor(left);
      const rightPresentation = presentationFor(right);
      return (
        actionGroupOrder(leftPresentation.group) - actionGroupOrder(rightPresentation.group) ||
        leftPresentation.order - rightPresentation.order ||
        left.title.localeCompare(right.title)
      );
    });
  return [...capabilities, agentAction];
});

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
  if (isAgentAction(action)) {
    void agentChat.openChat();
    return;
  }
  selectedAction.value = action;
  dialogOpen.value = true;
}

function closeDialog() {
  dialogOpen.value = false;
  selectedAction.value = null;
  store.clearShotDetectResult();
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

    if (hasAssetIdsInput(selectedAction.value)) {
      payload.input.asset_ids = selectedIds;
    } else {
      payload.asset_id = selectedIds[0];
    }

    await store.createJob(payload);
    closeDialog();
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
        <p class="text-muted-foreground text-xs">
          {{ store.selectedAssets.length }} selected
        </p>
      </div>
      <Badge v-if="store.selectedAssets.length" variant="outline">
        {{ availableActions.length }} available
      </Badge>
    </div>

    <div v-if="store.selectedAssets.length === 0" class="rounded-md border border-dashed p-4">
      <p class="text-muted-foreground">
        Select one or more assets to see compatible capabilities.
      </p>
    </div>

    <div v-else class="space-y-4 overflow-auto pr-1" @scroll="hideTooltip">
      <section v-for="[group, actions] in groupedActions" :key="group" class="space-y-2">
        <div class="flex items-center justify-between gap-2">
          <p class="uppercase tracking-wide text-muted-foreground font-bold text-xs">
            {{ group }}
          </p>
          <div class="h-px flex-1 bg-border" />
        </div>

        <div class="grid grid-cols-[repeat(auto-fill,minmax(36px,1fr))] gap-2">
          <div v-for="action in actions" :key="action.id">
            <button
              class="flex aspect-square w-full items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              :aria-label="action.title"
              :disabled="!isAgentAction(action) && creating"
              @blur="hideTooltip"
              @click="openAction(action)"
              @focus="showTooltip(action, $event)"
              @mouseenter="showTooltip(action, $event)"
              @mouseleave="hideTooltip"
            >
              <component :is="iconFor(action)" class="h-5 w-5" />
            </button>
          </div>
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
    @close="closeDialog"
    @submit="submitAction"
  />

  <AgentChatPanel />
</template>
