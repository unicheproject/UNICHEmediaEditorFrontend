<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { ChevronLeft, ChevronRight } from "lucide-vue-next";

import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import Select from "@/components/ui/Select.vue";
import { JOBS_PAGE_SIZE, useWorkspaceStore } from "@/stores/workspace";
import type { Job, JobStatus } from "@/types/api";

const store = useWorkspaceStore();

// Prefer the live (polled) copy of a job so status and progress keep updating.
const jobs = computed(() => {
  const live = new Map(store.jobs.map((job) => [job.id, job]));
  return store.jobsPageItems.map((job) => live.get(job.id) ?? job);
});

const pageCount = computed(() => Math.max(1, Math.ceil(store.jobsTotal / JOBS_PAGE_SIZE)));
const rangeStart = computed(() => (store.jobsPage - 1) * JOBS_PAGE_SIZE + 1);
const rangeEnd = computed(() => rangeStart.value + store.jobsPageItems.length - 1);

const STATUS_OPTIONS: { value: JobStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "queued", label: "Queued" },
  { value: "running", label: "Running" },
  { value: "succeeded", label: "Succeeded" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

const list = ref<HTMLElement | null>(null);

async function scrollToTop() {
  await nextTick();
  list.value?.scrollTo({ top: 0 });
}

async function goToPage(page: number) {
  try {
    await store.loadJobsPage(page);
    await scrollToTop();
  } catch (err) {
    store.setError(err instanceof Error ? err.message : "Unable to load jobs");
  }
}

async function filterByStatus(status: string) {
  try {
    await store.setJobsStatusFilter(status as JobStatus | "");
    await scrollToTop();
  } catch (err) {
    store.setError(err instanceof Error ? err.message : "Unable to load jobs");
  }
}

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
      <p class="text-muted-foreground text-xs">All project activity, newest first</p>
    </div>

    <label class="mb-3 block">
      <span class="sr-only">Filter jobs by status</span>
      <Select :model-value="store.jobsStatusFilter" @update:model-value="filterByStatus">
        <option v-for="option in STATUS_OPTIONS" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </Select>
    </label>

    <div v-if="jobs.length" ref="list" class="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
      <article v-for="job in jobs" :key="job.id" class="rounded-md border bg-background p-3">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="truncate font-bold text-xs">{{ job.capability_id }}</p>
            <p class="text-muted-foreground text-[10px]">{{ outputSummary(job) }}</p>
          </div>
          <div class="flex shrink-0 items-center gap-1.5">
            <div
              v-if="isActive(job.status)"
              class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted border-t-primary"
            />
            <Badge :variant="statusVariant(job.status)" class="py-1 px-2">{{ job.status }}</Badge>
          </div>
        </div>
        <div class="h-1 overflow-hidden rounded-full bg-muted">
          <div
            class="h-full rounded-full bg-primary transition-all"
            :class="{'progress-100': job.progress == 100}"
            :style="{ width: `${job.progress}%` }"
          />
        </div>
      </article>
    </div>

    <div
      v-if="store.jobsTotal > JOBS_PAGE_SIZE"
      class="mt-3 flex items-center justify-between gap-2 border-t pt-3"
    >
      <span class="text-[10px] text-muted-foreground">
        {{ rangeStart }}–{{ rangeEnd }} of {{ store.jobsTotal }}
      </span>
      <div class="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          title="Previous page"
          aria-label="Previous page"
          :disabled="store.jobsPage <= 1 || store.jobsPageLoading"
          @click="goToPage(store.jobsPage - 1)"
        >
          <ChevronLeft class="h-4 w-4" />
        </Button>
        <span class="min-w-12 text-center text-xs">{{ store.jobsPage }} / {{ pageCount }}</span>
        <Button
          variant="outline"
          size="icon"
          title="Next page"
          aria-label="Next page"
          :disabled="store.jobsPage >= pageCount || store.jobsPageLoading"
          @click="goToPage(store.jobsPage + 1)"
        >
          <ChevronRight class="h-4 w-4" />
        </Button>
      </div>
    </div>

    <p v-else-if="store.jobsStatusFilter" class="rounded-md border border-dashed p-4 text-muted-foreground">
      No {{ store.jobsStatusFilter }} jobs.
    </p>
    <p v-else class="rounded-md border border-dashed p-4 text-muted-foreground">
      Created jobs will appear here with live polling until they finish.
    </p>
  </Card>
</template>
