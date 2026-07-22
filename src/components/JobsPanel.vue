<script setup lang="ts">
import { computed } from "vue";

import Badge from "@/components/ui/Badge.vue";
import Card from "@/components/ui/Card.vue";
import { useWorkspaceStore } from "@/stores/workspace";
import type { Job, JobStatus } from "@/types/api";

const store = useWorkspaceStore();

const jobs = computed(() => store.latestJobs.slice(0, 8));

function statusVariant(status: JobStatus) {
  if (status === "succeeded") {
    return "success";
  }
  if (status === "failed" || status === "cancelled") {
    return "error";
  }
  return "secondary";
}

function isActive(status: JobStatus) {
  return status !== "succeeded" && status !== "failed" && status !== "cancelled";
}

function outputSummary(job: Job) {
  const outputs = job.output?.outputs;
  if (Array.isArray(outputs)) {
    return `${outputs.length} derived asset${outputs.length === 1 ? "" : "s"}`;
  }
  if (job.output) {
    return Object.keys(job.output).slice(0, 3).join(", ");
  }
  return job.error ?? "Waiting for output";
}
</script>

<template>
  <Card class="flex min-h-0 flex-col p-4 border-accent-top">
    <div class="mb-3">
      <h4>Jobs</h4>
      <p class="text-muted-foreground text-xs">Latest project activity</p>
    </div>

    <div v-if="jobs.length" class="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
      <article v-for="job in jobs" :key="job.id" class="rounded-md border bg-background p-3">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="truncate font-bold text-sm">{{ job.capability_id }}</p>
            <p class="mt-1 text-muted-foreground text-xs">{{ outputSummary(job) }}</p>
          </div>
          <div class="flex shrink-0 items-center gap-1.5">
            <div
              v-if="isActive(job.status)"
              class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted border-t-primary"
            />
            <Badge :variant="statusVariant(job.status)">{{ job.status }}</Badge>
          </div>
        </div>
        <div class="mt-2 h-1 overflow-hidden rounded-full bg-muted">
          <div
            class="h-full rounded-full bg-primary transition-all"
            :style="{ width: `${job.progress}%` }"
          />
        </div>
      </article>
    </div>

    <p v-else class="rounded-md border border-dashed p-4 text-muted-foreground">
      Created jobs will appear here with live polling until they finish.
    </p>
  </Card>
</template>
