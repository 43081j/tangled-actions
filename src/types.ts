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
 * A single entry in a workflow's `when` list
 */
export interface WorkflowConstraint {
  /**
   * Event kind(s) this constraint applies to, e.g. `push` or `pull_request`.
   */
  event?: MaybeArray<WorkflowEvent>;

  /**
   * Branch name glob(s)
   */
  branch?: MaybeArray<string>;

  /**
   * Tag name glob(s)
   */
  tag?: MaybeArray<string>;

  /**
   * Changed-file glob(s)
   */
  paths?: MaybeArray<string>;
}

/**
 * Controls how the repository is cloned before a workflow runs.
 */
export interface WorkflowCloneOptions {
  /**
   * Skip cloning entirely
   * Defaults to `false`.
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
 * A single step in a workflow.
 */
export interface WorkflowStep {
  /**
   * Shell command to run.
   */
  command: string;

  /**
   * Human-readable name shown in logs.
   */
  name?: string;

  /**
   * Environment variables scoped to this step.
   */
  environment?: Record<string, string>;
}

/**
 * Fields shared by every engine's workflow manifest.
 */
export interface WorkflowBase {
  /**
   * Trigger constraints. The workflow runs if any constraint matches. An empty
   * or omitted `when` means the workflow always runs.
   */
  when?: WorkflowConstraint[];

  /**
   * Clone behaviour for the workflow's checkout.
   */
  clone?: WorkflowCloneOptions;

  /**
   * The steps to run, in order.
   */
  steps?: WorkflowStep[];

  /**
   * Environment variables applied to every step in the workflow.
   */
  environment?: Record<string, string>;
}

/**
 * A workflow run by the `nixery` engine.
 */
export interface NixeryWorkflow extends WorkflowBase {
  engine: 'nixery';

  /**
   * Packages to make available, keyed by registry.
   * For example, `nixpkgs`: `{ nixpkgs: ['ripgrep', 'jq'] }`.
   */
  dependencies?: Record<string, string[]>;
}

/**
 * A workflow run by the `microvm` engine.
 */
export interface MicrovmWorkflow extends WorkflowBase {
  engine: 'microvm';

  /**
   * Base image for the VM.
   */
  image?: string;

  /**
   * Packages to make available inside the VM.
   */
  dependencies?: string[];

  /**
   * Services to run alongside the workflow.
   */
  services?: Record<string, unknown>;

  /**
   * Virtualisation tuning (CPU, memory, etc.).
   */
  virtualisation?: Record<string, unknown>;

  /**
   * Package registry configuration.
   */
  registry?: Record<string, unknown>;

  /**
   * Nix binary caches, mapping substituter URL to its trusted public key.
   */
  caches?: Record<string, string>;
}

/**
 * A single tangled workflow file (`.tangled/workflows/<name>.yml`), discriminated
 * by its `engine`.
 */
export type Workflow = NixeryWorkflow | MicrovmWorkflow;

/**
 * Engine names understood by this model, derived from {@link Workflow}.
 */
export type WorkflowEngine = Workflow['engine'];

/**
 * A pipeline is the set of workflows in a repository, which execute in
 * parallel.
 */
export type Pipeline = Workflow[];
