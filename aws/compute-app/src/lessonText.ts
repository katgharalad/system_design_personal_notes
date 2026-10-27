import workload from './lessons/workload.md?raw';
import runtime from './lessons/runtime.md?raw';
import ownership from './lessons/ownership.md?raw';
import scale from './lessons/scale.md?raw';
import placement from './lessons/placement.md?raw';
import lambdaLifecycle from './lessons/lambda-lifecycle.md?raw';
const moduleLessons = import.meta.glob('./content/aws-compute/unit-*/lessons/*.md', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
const moduleLessonText = Object.fromEntries(Object.entries(moduleLessons).map(([path, text]) => [path.split('/').at(-1)!.replace(/\.md$/, ''), text]));
export const lessonText: Record<string, string> = { workload, runtime, ownership, scale, placement, 'lambda-lifecycle': lambdaLifecycle, ...moduleLessonText };
