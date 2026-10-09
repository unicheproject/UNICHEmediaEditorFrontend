<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-vue-next";

import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import Select from "@/components/ui/Select.vue";
import { api } from "@/lib/api";
import { JOBS_PAGE_SIZE, useWorkspaceStore } from "@/stores/workspace";
import type { Job, JobStatus } from "@/types/api";

defineProps<{ expanded: boolean }>();
const emit = defineEmits<{ expand: [] }>();

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

const detailsJobId = ref<string | null>(null);
const details = ref<Job | null>(null);
const detailsLoading = ref(false);
const detailsError = ref<string | null>(null);

async function loadDetails(jobId: string) {
  detailsLoading.value = true;
  detailsError.value = null;
  try {
    const job = await api.getJob(jobId);
    if (detailsJobId.value === jobId) {
      details.value = job;
    }
  } catch (err) {
    if (detailsJobId.value === jobId) {
      detailsError.value = err instanceof Error ? err.message : "Unable to load job details";
    }
  } finally {
    if (detailsJobId.value === jobId) {
      detailsLoading.value = false;
    }
  }
}

function toggleDetails(job: Job) {
  if (detailsJobId.value === job.id) {
    detailsJobId.value = null;
    details.value = null;
    return;
  }
  detailsJobId.value = job.id;
  details.value = null;
  void loadDetails(job.id);
}

// Refresh the open details whenever polling reports a change to that job.
watch(
  () => jobs.value.find((job) => job.id === detailsJobId.value)?.updated_at,
  (updatedAt, previous) => {
    if (detailsJobId.value && updatedAt && previous && updatedAt !== previous) {
      void loadDetails(detailsJobId.value);
    }
  },
);

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatElapsed(job: Job) {
  if (!job.started_at || !job.finished_at) return "—";
  const seconds = (new Date(job.finished_at).getTime() - new Date(job.started_at).getTime()) / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  return `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`;
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}
</script>

<template>
  <Card
    class="flex min-h-0 flex-col p-4 border-accent-top"
    :class="expanded ? 'flex-1' : 'shrink-0'"
  >
    <button
      type="button"
      class="flex w-full items-start justify-between gap-3 text-left"
      :class="{ 'mb-3': expanded }"
      :aria-expanded="expanded"
      @click="emit('expand')"
    >
      <div>
        <h4>Jobs</h4>
        <p class="text-muted-foreground text-xs">All project activity, newest first</p>
      </div>
      <ChevronDown
        class="h-4 w-4 shrink-0 text-muted-foreground transition-transform"
        :class="{ 'rotate-180': expanded }"
      />
    </button>

    <div v-show="expanded" class="flex min-h-0 flex-1 flex-col">
      <label class="mb-2 block">
        <span class="sr-only">Filter jobs by status</span>
        <Select
          class="py-1.5 pl-3 text-xs"
          :model-value="store.jobsStatusFilter"
          @update:model-value="filterByStatus"
        >
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
          <button
            type="button"
            class="mt-2 flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
            :aria-expanded="detailsJobId === job.id"
            @click="toggleDetails(job)"
          >
            {{ detailsJobId === job.id ? "Hide details" : "View details" }}
            <ChevronDown
              class="h-3 w-3 transition-transform"
              :class="{ 'rotate-180': detailsJobId === job.id }"
            />
          </button>
          <div v-if="detailsJobId === job.id" class="mt-2 space-y-2 border-t pt-2 text-[10px]">
            <p v-if="detailsError" class="text-destructive">{{ detailsError }}</p>
            <p v-else-if="!details" class="text-muted-foreground">Loading details…</p>
            <template v-else>
              <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt class="text-muted-foreground">Job ID</dt>
                <dd class="break-all font-mono">{{ details.id }}</dd>
                <dt class="text-muted-foreground">Asset</dt>
                <dd class="break-all font-mono">{{ details.asset_id ?? "—" }}</dd>
                <dt class="text-muted-foreground">Progress</dt>
                <dd>{{ details.progress }}%</dd>
                <dt class="text-muted-foreground">Created</dt>
                <dd>{{ formatDateTime(details.created_at) }}</dd>
                <dt class="text-muted-foreground">Started</dt>
                <dd>{{ formatDateTime(details.started_at) }}</dd>
                <dt class="text-muted-foreground">Finished</dt>
                <dd>{{ formatDateTime(details.finished_at) }}</dd>
                <dt class="text-muted-foreground">Run time</dt>
                <dd>{{ formatElapsed(details) }}</dd>
              </dl>
              <div v-if="details.error">
                <p class="mb-1 font-semibold">Error</p>
                <p class="whitespace-pre-wrap break-words rounded bg-muted p-2 text-destructive">{{ details.error }}</p>
              </div>
              <div>
                <p class="mb-1 font-semibold">Input</p>
                <pre class="max-h-40 overflow-auto rounded bg-muted p-2 font-mono">{{ formatJson(details.input) }}</pre>
              </div>
              <div v-if="details.output">
                <p class="mb-1 font-semibold">Output</p>
                <pre class="max-h-40 overflow-auto rounded bg-muted p-2 font-mono">{{ formatJson(details.output) }}</pre>
              </div>
            </template>
          </div>
        </article>
      </div>

      <div
        v-if="store.jobsTotal > JOBS_PAGE_SIZE"
        class="mt-2 flex items-center justify-between gap-2 border-t pt-2"
      >
        <span class="text-[10px] text-muted-foreground">
          {{ rangeStart }}–{{ rangeEnd }} of {{ store.jobsTotal }}
        </span>
        <div class="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            class="h-7 w-7"
            title="Previous page"
            aria-label="Previous page"
            :disabled="store.jobsPage <= 1 || store.jobsPageLoading"
            @click="goToPage(store.jobsPage - 1)"
          >
            <ChevronLeft class="h-3.5 w-3.5" />
          </Button>
          <span class="min-w-12 text-center text-xs">{{ store.jobsPage }} / {{ pageCount }}</span>
          <Button
            variant="outline"
            size="icon"
            class="h-7 w-7"
            title="Next page"
            aria-label="Next page"
            :disabled="store.jobsPage >= pageCount || store.jobsPageLoading"
            @click="goToPage(store.jobsPage + 1)"
          >
            <ChevronRight class="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <p v-else-if="store.jobsStatusFilter" class="rounded-md border border-dashed p-4 text-muted-foreground">
        No {{ store.jobsStatusFilter }} jobs.
      </p>
      <p v-else class="rounded-md border border-dashed p-4 text-muted-foreground">
        Created jobs will appear here with live polling until they finish.
      </p>
    </div>
  </Card>
</template>
