import workload from './lessons/workload.md?raw';
import runtime from './lessons/runtime.md?raw';
import ownership from './lessons/ownership.md?raw';
import scale from './lessons/scale.md?raw';
import placement from './lessons/placement.md?raw';
import lambdaLifecycle from './lessons/lambda-lifecycle.md?raw';
export const lessonText: Record<string, string> = { workload, runtime, ownership, scale, placement, 'lambda-lifecycle': lambdaLifecycle };
