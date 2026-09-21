/**
 * queue feature 의 공개 API — 가상 대기실.
 * 밖에서는 반드시 `@/features/queue` 로만 가져다 씁니다.
 */

// Controller
export { useQueueStatus, useQueueWaiting, useLeaveQueue, useQueueEviction } from './hooks/useQueue';

// View
export { QueueWaitingCard } from './components/QueueWaitingCard';

// Model
export { queueApi, queueKeys } from './api/queueApi';
export { estimatedWaitLabel, nextPollMs } from './model/queue.model';
export { QUEUE_ERROR, type QueueStatus } from './model/queue.types';
