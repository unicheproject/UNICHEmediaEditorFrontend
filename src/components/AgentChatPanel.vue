<script setup lang="ts">
import { Bot, Send, X } from "lucide-vue-next";
import { computed, nextTick, ref, watch } from "vue";

import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import Textarea from "@/components/ui/Textarea.vue";
import { useAgentChatStore } from "@/stores/agentChat";
import type { AgentPlan, PlanStep, StepRun } from "@/types/api";

const chat = useAgentChatStore();

const draft = ref("");
const scrollEl = ref<HTMLElement | null>(null);

const busy = computed(() => chat.sending || chat.creatingSession);

function paramsSummary(step: PlanStep) {
  const entries = Object.entries(step.params ?? {});
  if (entries.length === 0) {
    return "";
  }
  return entries
    .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`)
    .join(", ");
}

function runFor(plan: AgentPlan, step: PlanStep): StepRun | undefined {
  return plan.step_runs.find((run) => run.step_id === step.id);
}

function statusVariant(status?: string) {
  if (status === "succeeded") {
    return "success";
  }
  if (status === "failed" || status === "cancelled") {
    return "warning";
  }
  return "secondary";
}

function planStatusVariant(status: AgentPlan["status"]) {
  if (status === "succeeded") {
    return "success";
  }
  if (status === "failed") {
    return "warning";
  }
  return "secondary";
}

function send() {
  const text = draft.value;
  draft.value = "";
  void chat.send(text);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    if (!busy.value && draft.value.trim()) {
      send();
    }
  }
}

watch(
  () => [chat.messages.length, chat.messages[chat.messages.length - 1]],
  async () => {
    await nextTick();
    if (scrollEl.value) {
      scrollEl.value.scrollTop = scrollEl.value.scrollHeight;
    }
  },
  { deep: true },
);
</script>

<template>
  <Teleport to="body">
    <div v-if="chat.open" class="fixed inset-0 z-50">
      <button
        class="absolute inset-0 cursor-default bg-foreground/30"
        type="button"
        aria-label="Close agent chat"
        @click="chat.closeChat()"
      />
      <div
        class="fixed inset-y-0 right-0 flex w-full max-w-md flex-col border-l bg-card text-card-foreground shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Agent chat"
      >
        <!-- Header -->
        <div class="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div class="flex items-center gap-2">
            <Bot class="h-5 w-5 text-primary" />
            <h2 class="font-semibold">Agent</h2>
            <Badge variant="outline">
              {{ chat.scopeCount }} asset{{ chat.scopeCount === 1 ? "" : "s" }}
            </Badge>
          </div>
          <Button variant="ghost" size="icon" @click="chat.closeChat()">
            <X class="h-4 w-4" />
            <span class="sr-only">Close</span>
          </Button>
        </div>

        <!-- Scrollback -->
        <div ref="scrollEl" class="flex-1 space-y-3 overflow-auto px-4 py-4">
          <p v-if="chat.creatingSession" class="text-sm text-muted-foreground">
            Starting a session…
          </p>

          <p
            v-else-if="chat.messages.length === 0"
            class="rounded-md border border-dashed p-4 text-sm text-muted-foreground"
          >
            Describe what you'd like to do with the selected assets. The agent will propose a
            plan you can review before it runs.
          </p>

          <template v-for="(entry, index) in chat.messages" :key="index">
            <!-- User -->
            <div v-if="entry.kind === 'user'" class="flex justify-end">
              <div class="max-w-[85%] whitespace-pre-wrap rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
                {{ entry.text }}
              </div>
            </div>

            <!-- Assistant text / clarification -->
            <div v-else-if="entry.kind === 'assistant'" class="flex justify-start">
              <div class="max-w-[85%] whitespace-pre-wrap rounded-lg bg-muted px-3 py-2 text-sm">
                {{ entry.text }}
              </div>
            </div>

            <!-- Plan card -->
            <div v-else class="rounded-lg border bg-background p-3">
              <div class="mb-2 flex items-start justify-between gap-2">
                <p class="text-sm font-medium">Proposed plan</p>
                <Badge :variant="planStatusVariant(entry.plan.status)">
                  {{ entry.plan.status }}
                </Badge>
              </div>

              <p v-if="entry.plan.summary" class="mb-3 text-sm text-muted-foreground">
                {{ entry.plan.summary }}
              </p>

              <ol class="space-y-2">
                <li
                  v-for="(step, stepIndex) in entry.plan.steps"
                  :key="step.id"
                  class="rounded-md border bg-card p-2"
                >
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-sm font-medium">
                      {{ stepIndex + 1 }}. {{ step.capability_id }}
                    </span>
                    <Badge
                      v-if="runFor(entry.plan, step)?.status"
                      :variant="statusVariant(runFor(entry.plan, step)?.status)"
                    >
                      {{ runFor(entry.plan, step)?.status }}
                    </Badge>
                  </div>
                  <p v-if="paramsSummary(step)" class="mt-1 text-xs text-muted-foreground">
                    {{ paramsSummary(step) }}
                  </p>
                  <p
                    v-if="runFor(entry.plan, step)?.error"
                    class="mt-1 text-xs text-destructive"
                  >
                    {{ runFor(entry.plan, step)?.error }}
                  </p>
                </li>
              </ol>

              <div
                v-if="entry.plan.status === 'proposed'"
                class="mt-3 flex justify-end"
              >
                <Button size="sm" :disabled="chat.approving" @click="chat.approve()">
                  {{ chat.approving ? "Starting…" : "Approve & run" }}
                </Button>
              </div>

              <p
                v-else-if="entry.plan.status === 'succeeded'"
                class="mt-3 text-sm text-emerald-700"
              >
                Done — {{ entry.plan.result_asset_ids.length }} new asset{{
                  entry.plan.result_asset_ids.length === 1 ? "" : "s"
                }}
                added to your library.
              </p>

              <p
                v-else-if="entry.plan.status === 'failed'"
                class="mt-3 text-sm text-destructive"
              >
                {{ entry.plan.error ?? "The plan failed to run." }}
              </p>

              <p
                v-else
                class="mt-3 text-sm text-muted-foreground"
              >
                Running…
              </p>
            </div>
          </template>

          <p v-if="chat.error" class="text-sm text-destructive">{{ chat.error }}</p>
        </div>

        <!-- Composer -->
        <div class="border-t p-3">
          <div class="flex items-end gap-2">
            <Textarea
              v-model="draft"
              :rows="2"
              placeholder="Describe a workflow… (Enter to send, Shift+Enter for a new line)"
              class="min-h-[2.5rem] flex-1 resize-none"
              @keydown="onKeydown"
            />
            <Button
              size="icon"
              :disabled="busy || !draft.trim()"
              aria-label="Send message"
              @click="send()"
            >
              <Send class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
