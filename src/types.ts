export type MaybeArray<T> = T | T[];

/**
 * The kinds of events that can trigger a workflow.
 *
 * - `push` matches a git push
 * - `pull_request` matches a pull request
 * - `manual` is dispatched by a user
 */
export type WorkflowEvent = 'push' | 'pull_request' | 'manual';

/**
 * Execution engine a workflow runs on, e.g. `nixery`.
 */
export type WorkflowEngine = string;

/**
 * Represents a constraint on when a workflow runs
 */
export interface WorkflowConstraint {
  /**
   * Event kind(s) this constraint applies to, e.g. `push` or `pull_request`.
   */
  event?: MaybeArray<WorkflowEvent>;

  /**
   * Branch name glob
   */
  branch?: MaybeArray<string>;

  /**
   * Tag name glob
   */
  tag?: MaybeArray<string>;

  /**
   * Changed-file glob
   */
  paths?: MaybeArray<string>;
}

/**
 * Controls how the repository is cloned before a workflow runs.
 */
export interface WorkflowCloneOptions {
  /**
   * Skip cloning entirely.
   */
  skip?: boolean;

  /**
   * Create a shallow clone with the given history depth. `0` (the default)
   * means a full clone.
   */
  depth?: number;

  /**
   * Whether to clone submodules. Defaults to `true`.
   */
  submodules?: boolean;

  /**
   * Whether to fetch tags. Defaults to `true`.
   */
  tags?: boolean;
}

/**
 * A single tangled workflow file (`.tangled/workflows/<name>.yml`).
 */
export interface Workflow {
  /**
   * The engine used to execute this workflow's steps, e.g. `nixery`.
   */
  engine: WorkflowEngine;

  /**
   * Trigger constraints. The workflow runs if any constraint matches. An empty
   * or omitted `when` means the workflow always runs.
   */
  when?: WorkflowConstraint[];

  /**
   * Clone behaviour for the workflow's checkout.
   */
  clone?: WorkflowCloneOptions;
}

/**
 * A pipeline is the set of workflows in a repository
 */
export type Pipeline = Workflow[];
