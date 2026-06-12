<script setup lang="ts">
import { computed, ref } from "vue";

import ActionDialog from "@/components/ActionDialog.vue";
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

    <div v-else class="space-y-4 overflow-auto pr-1">
      <section v-for="[group, actions] in groupedActions" :key="group" class="space-y-2">
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {{ group }}
          </h3>
          <div class="h-px flex-1 bg-border" />
        </div>

        <div class="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-2">
          <div v-for="action in actions" :key="action.id" class="group relative">
            <button
              class="flex aspect-square w-full items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              :aria-label="action.title"
              :disabled="isAgentAction(action) || creating"
              @click="openAction(action)"
            >
              <component :is="iconFor(action)" class="h-5 w-5" />
            </button>

            <div
              class="pointer-events-none absolute right-0 top-[calc(100%+0.5rem)] z-20 hidden w-72 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg group-focus-within:block group-hover:block"
            >
              <div class="mb-2 flex flex-wrap items-center gap-2">
                <p class="text-sm font-medium">{{ action.title }}</p>
                <Badge v-if="isAgentAction(action)" variant="warning">Stub</Badge>
                <Badge v-else variant="secondary">{{ costLabel(action.cost_class) }}</Badge>
                <Badge v-if="!isAgentAction(action) && hasAssetIdsInput(action)" variant="outline">
                  Multi
                </Badge>
              </div>
              <p class="text-xs leading-5 text-muted-foreground">
                {{ action.description }}
              </p>
              <p
                v-if="!isAgentAction(action)"
                class="mt-2 text-xs text-muted-foreground"
              >
                {{ action.supported_media_types.join(", ") }}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  </Card>

  <ActionDialog
    :open="dialogOpen"
    :action="selectedAction"
    @close="dialogOpen = false"
    @submit="submitAction"
  />
</template>
