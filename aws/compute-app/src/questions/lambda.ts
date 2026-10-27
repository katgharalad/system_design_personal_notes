import type { InterviewQuestion } from '../questions';

const base = {
  lesson: 'lambda-lifecycle', unit: '03' as const, topic: 'lambda-lifecycle',
  prerequisites: ['workload','scale'], revisionNotes: ['lambda-lifecycle'],
  sources: ['lambda-execution','lambda-concurrency'],
};

export const lambdaQuestions: InterviewQuestion[] = [
  {
    ...base, id:'L01', difficulty:'Foundation', difficultyLevel:1, mode:'Deep dive', assessmentType:'Explain the internals',
    prompt:'Trace one cold synchronous Lambda Event Function invocation. What happens before and after the handler?',
    scenario:'First request after a period with no ready environment.',
    assumptions:['Standard on-demand Event Function; synchronous direct invocation; no provisioned concurrency.'],
    learningObjective:'Distinguish Init, Invoke, possible reuse and shutdown.',
    answer:'Lambda prepares a new execution environment, loads code and runtime, initializes extensions and code outside the handler, and then invokes the handler with the event. The handler returns a result. Lambda may freeze and retain the environment so a later invocation can reuse it, but the application cannot rely on how long it persists. A later reset or shutdown can end that reuse path.',
    explanation:'Cold request par pehle Init, phir Invoke. Handler ke bahar ka code Init mein aata hai. Completion ke baad environment reuse possible hai, promise nahi. Video ke bar widths exact latency nahi dikhate.',
    rubric:['Places Init before Invoke','Explains what initializes outside the handler','Says reuse is possible but not guaranteed'],
    mistakes:['Saying handler always runs before static initialization','Treating /tmp or process memory as durable state'],
    hint:'Name the phases and the reuse condition.', followUp:'What changes when the next request finds the environment idle?',
    concepts:['Init','Invoke','execution environment reuse'], followUps:['L02','L02']
  },
  {
    ...base, id:'L02', difficulty:'Applied', difficultyLevel:2, mode:'Deep dive', assessmentType:'Explain the internals',
    prompt:'Request 2 reuses idle environment A. While A handles it, request 3 arrives. Explain the path for both and the peak concurrency.',
    scenario:'Two requests overlap on a standard on-demand Event Function.',
    assumptions:['Capacity and scaling rules allow another environment to start.'],
    learningObjective:'Explain reuse and one active invocation per environment.',
    answer:'A handles request 2 without normal static Init repeating. Because A is busy when request 3 arrives, Lambda needs another execution environment for a concurrent standard Event Function invocation. It can create B, run B’s Init, then invoke request 3 there. Peak active invocation concurrency is two. If quota or scaling capacity prevents B from starting, the caller may see a throttle instead of this illustrated path.',
    explanation:'A warm reuse karega; request 3 usi A mein simultaneous nahi chalegi. B ka apna Init hai. Concurrency count do active invokes ka hai, all historical environments ka nahi.',
    rubric:['Says A can avoid a second Init on reuse','Says B needs its own Init for overlap','Calculates peak active concurrency of two'],
    mistakes:['Running two requests at once in A','Counting idle environments as active invocations'],
    hint:'Can A process two invokes at the same instant?', followUp:'What if a reserved concurrency cap is one?',
    concepts:['warm reuse','overlap','concurrency'], followUps:['L01','L03']
  },
  {
    ...base, id:'L03', difficulty:'Applied', difficultyLevel:3, mode:'Decision', assessmentType:'Numerical engineering',
    prompt:'At 120 RPS and 250 ms mean duration, estimate concurrency. The database has 20 useful connections; each active invocation may use one. Defend a first capacity test.',
    scenario:'A synchronous API scales Lambda faster than its database can accept connections.',
    assumptions:['Use average duration as a planning estimate, not a peak guarantee.','Other database clients may also consume connections.'],
    learningObjective:'Calculate concurrency and find a downstream bottleneck.',
    answer:'The simple planning estimate is 120 × 0.25 = 30 concurrent invocations. If each active invocation opens one database connection, demand can exceed the stated 20 useful connections even before other clients and bursts. I would measure actual connection behavior, bound concurrency below the measured safe share, and load test caller latency and throttles. I would evaluate connection pooling or RDS Proxy where suitable, while checking session pinning and database query capacity.',
    explanation:'30 compute slots ka estimate hai; DB 20 useful connections hi deta hai. Reserved cap protect kar sakta hai, lekin sync request throttle ho sakti hai. Pooling connection reuse deta hai, database CPU ya locks nahi banata.',
    rubric:['Calculates 30','Identifies DB connection budget as tighter','Proposes measured bound and a caller-visible validation'],
    mistakes:['Increasing Lambda quota as the only fix','Claiming RDS Proxy creates unlimited database capacity'],
    hint:'Multiply rate by seconds, then compare resource budgets.', followUp:'What user-visible effect follows from a low reserved concurrency cap?',
    concepts:['Little’s Law estimate','reserved concurrency','database pressure'], followUps:['L02','L04']
  },
  {
    ...base, id:'L04', difficulty:'Defense', difficultyLevel:5, mode:'Debugging', assessmentType:'Architecture and service choice',
    prompt:'A burst causes Lambda throttles and database errors. Product asks you to remove the concurrency cap to stop throttles. Defend your response and plan a safe rollout.',
    scenario:'Synchronous API; latency target is 800 ms p95; retries exist; database is near its connection limit.',
    assumptions:['No evidence yet that the function code is CPU bound.','Retry policy and database pool settings must be inspected.'],
    learningObjective:'Balance caller throttling against downstream saturation and retry amplification.',
    answer:'I would not remove the cap without a load test because extra invokes can exhaust the database and turn explicit throttles into slower failures. First correlate ConcurrentExecutions, Throttles, p95 latency, DB active connections, query time, and retry rate. I would measure a safe concurrency share, inspect connection reuse or RDS Proxy with pinning limits, reduce per-request DB work, and apply backoff. If the operation can be asynchronous, a queue may smooth load, but that changes latency and requires idempotency. Roll out a measured cap increase in steps with alarms and rollback criteria.',
    explanation:'Throttle ek clear limit signal hai; cap remove karne se DB collapse aur retry storm ho sakta hai. Metrics same timeline par dekhkar stepwise test karo. Queue only agar contract delay allow kare.',
    rubric:['Explains why uncapping can worsen DB failures','Names metrics and retry behavior','Gives staged test, mitigation, and rollback criteria'],
    mistakes:['Removing the cap before measuring DB capacity','Assuming a proxy fixes slow queries or pinning'],
    hint:'What happens to database demand if all throttled calls now run?', followUp:'If the handler commits a write then times out, how will retry avoid a duplicate?',
    concepts:['throttling','backpressure','idempotency','rollout'], followUps:['L03','L04']
  }
];
