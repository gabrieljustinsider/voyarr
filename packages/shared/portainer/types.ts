/**
 * Shared Portainer & Container Orchestration Types
 * GameProductions Foundation Fleet Standard (Rule 26)
 */

export type PortainerEndpointType = 
  | 1 // Local Docker Socket
  | 2 // Portainer Agent (TCP)
  | 3 // Azure ACI
  | 4 // Edge Agent
  | 5 // Local Kubernetes
  | 6 // Kubernetes Agent
  | 7 // Edge Agent (Kubernetes);

export interface PortainerEnvironment {
  id: number;
  name: string;
  type: PortainerEndpointType;
  url: string;
  status: 'up' | 'down' | 'degraded';
  groupId: number;
  groupName?: string;
  totalContainers: number;
  runningContainers: number;
  stoppedContainers: number;
  healthyContainers: number;
  unhealthyContainers: number;
  totalImages: number;
  totalVolumes: number;
  totalStacks: number;
  dockerVersion?: string;
  edgeId?: string;
  tags?: string[];
  publicUrl?: string;
}

export interface PortainerStackVolume {
  name: string;
  containerPath: string;
  isNamed: boolean;
  category?: 'config' | 'data' | 'logs' | 'backups' | 'certs' | 'cache' | 'upload' | 'media';
}

export interface PortainerStackNetwork {
  name: string;
  driver?: string;
  scope?: string;
  ipam?: {
    ipv4Address?: string;
    gateway?: string;
  };
  aliases?: string[];
}

export interface PortainerStackImage {
  name: string;
  repository: string;
  tag: string;
  digest?: string;
  localDigest?: string;
  remoteDigest?: string;
  localCreated?: number;
  remoteUpdated?: string;
  registryUrl?: string;
  status: 'up-to-date' | 'update-available' | 'checking' | 'unknown';
}

export interface PortainerStack {
  id: number;
  name: string;
  type: number; // 2 = Compose
  endpointId: number;
  endpointName?: string;
  status: 1 | 2; // 1 = Active/Running, 2 = Stopped
  statusLabel: 'running' | 'stopped' | 'degraded';
  entryPoint: string;
  projectPath: string;
  creationDate: number;
  updateDate: number;
  updatedBy: string;
  autoUpdate?: boolean;
  namedVolumes: PortainerStackVolume[];
  hostMounts: PortainerStackVolume[];
  env: Array<{ name: string; value: string }>;
  onePasswordItemId?: string;
  websiteUrl?: string;
  customIcon?: string;
  tags?: string[];
}

export interface PortainerStackDetails extends PortainerStack {
  composeFile: string;
  volumesGrouped: {
    named: PortainerStackVolume[];
    binds: PortainerStackVolume[];
  };
  networks: PortainerStackNetwork[];
  images: PortainerStackImage[];
  containers: PortainerContainer[];
  services: Array<{
    name: string;
    image: string;
    status: string;
    ports: string[];
  }>;
}

export interface PortainerContainer {
  id: string;
  names: string[];
  primaryName: string;
  image: string;
  imageId: string;
  command: string;
  created: number;
  state: 'running' | 'exited' | 'restarting' | 'paused' | 'dead';
  status: string; // e.g. "Up 4 hours (healthy)"
  health?: 'healthy' | 'unhealthy' | 'starting' | 'none';
  ports: Array<{
    ip?: string;
    privatePort: number;
    publicPort?: number;
    type: 'tcp' | 'udp';
  }>;
  mounts?: Array<{
    type: 'bind' | 'volume';
    name?: string;
    source: string;
    destination: string;
    driver?: string;
    rw: boolean;
  }>;
  stackName?: string;
  endpointId: number;
  customIcon?: string;
}

export type ScheduledTaskAction = 
  | 'pull_redeploy'
  | 'restart'
  | 'backup'
  | 'maintenance_window'
  | 'health_probe';

export interface ScheduledTask {
  id: string;
  title: string;
  description?: string;
  endpointId: number;
  endpointName?: string;
  targetStackId?: number;
  targetStackName?: string;
  targetContainerId?: string;
  action: ScheduledTaskAction;
  cronExpression: string; // e.g. "0 3 * * 0" (Sunday at 3am)
  cronLabel: string; // e.g. "Every Sunday at 3:00 AM"
  enabled: boolean;
  createdAt: number;
  lastRun?: number;
  lastRunStatus?: 'success' | 'failed';
  lastRunMessage?: string;
  nextRun?: number;
}

export interface CreateEnvironmentPayload {
  name: string;
  type: PortainerEndpointType;
  url: string;
  publicUrl?: string;
  groupId?: number;
  tags?: string[];
  tls?: {
    skipVerify?: boolean;
    certFile?: string;
    keyFile?: string;
    caFile?: string;
  };
}
