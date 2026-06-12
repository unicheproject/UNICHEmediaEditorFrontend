<script setup lang="ts">
import { computed, ref } from "vue";
import { Bot, Cpu, Play, Sparkles, Wrench } from "lucide-vue-next";

import ActionDialog from "@/components/ActionDialog.vue";
import Badge from "@/components/ui/Badge.vue";
import Card from "@/components/ui/Card.vue";
import {
  agentAction,
  costLabel,
  hasAssetIdsInput,
  isAgentAction,
  supportsSelection,
  type ActionOption,
} from "@/lib/capabilities";
import { useWorkspaceStore } from "@/stores/workspace";
import type { Capability } from "@/types/api";

const store = useWorkspaceStore();
const dialogOpen = ref(false);
const selectedAction = ref<Capability | null>(null);
const creating = ref(false);

const availableActions = computed<ActionOption[]>(() => {
  if (store.selectedAssets.length === 0) {
    return [];
  }
  const capabilities = store.capabilities
    .filter((capability) => supportsSelection(capability, store.selectedAssets))
    .sort((left, right) => left.title.localeCompare(right.title));
  return [...capabilities, agentAction];
});

function iconFor(action: ActionOption) {
  if (isAgentAction(action)) {
    return Bot;
  }
  if (action.cost_class === "deterministic") {
    return Wrench;
  }
  if (action.cost_class === "future_gpu") {
    return Cpu;
  }
  return Sparkles;
}

function openAction(action: ActionOption) {
  if (isAgentAction(action)) {
    return;
  }
  selectedAction.value = action;
  dialogOpen.value = true;
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
    dialogOpen.value = false;
    selectedAction.value = null;
  } catch (err) {
    store.setError(err instanceof Error ? err.message : "Unable to create job");
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <Card class="flex min-h-0 flex-col p-4">
    <div class="mb-3 flex items-start justify-between gap-3">
      <div>
        <h2 class="font-semibold">Actions</h2>
        <p class="text-sm text-muted-foreground">
          {{ store.selectedAssets.length }} selected
        </p>
      </div>
      <Badge v-if="store.selectedAssets.length" variant="outline">
        {{ availableActions.length }} available
      </Badge>
    </div>

    <div v-if="store.selectedAssets.length === 0" class="rounded-md border border-dashed p-4">
      <p class="text-sm text-muted-foreground">
        Select one or more assets to see compatible capabilities.
      </p>
    </div>

    <div v-else class="grid gap-2 overflow-auto pr-1">
      <button
        v-for="action in availableActions"
        :key="action.id"
        class="rounded-lg border bg-background p-3 text-left transition-colors hover:border-primary/60 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        type="button"
        :disabled="isAgentAction(action) || creating"
        @click="openAction(action)"
      >
        <div class="flex items-start gap-3">
          <component :is="iconFor(action)" class="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="text-sm font-medium">{{ action.title }}</h3>
              <Badge v-if="isAgentAction(action)" variant="warning">Stub</Badge>
              <Badge v-else variant="secondary">{{ costLabel(action.cost_class) }}</Badge>
              <Badge v-if="!isAgentAction(action) && hasAssetIdsInput(action)" variant="outline">
                Multi
              </Badge>
            </div>
            <p class="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
              {{ action.description }}
            </p>
          </div>
          <Play v-if="!isAgentAction(action)" class="mt-0.5 h-4 w-4 text-muted-foreground" />
        </div>
      </button>
    </div>
  </Card>

  <ActionDialog
    :open="dialogOpen"
    :action="selectedAction"
    @close="dialogOpen = false"
    @submit="submitAction"
  />
</template>
