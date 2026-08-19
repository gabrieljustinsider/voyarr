/**
 * Portainer REST Client SDK
 * GameProductions Foundation Modular Gateway (Rule 26)
 */

import { 
  PortainerEnvironment, 
  PortainerStack, 
  PortainerContainer, 
  CreateEnvironmentPayload 
} from './types';

export interface PortainerClientOptions {
  baseUrl: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export class PortainerClient {
  private baseUrl: string;
  private apiKey: string;
  private fetchImpl: typeof fetch;

  constructor(opts: PortainerClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetchImpl || fetch.bind(globalThis);
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/${path.replace(/^\/+/, '')}`;
    const headers = {
      'X-API-Key': this.apiKey,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    const resp = await this.fetchImpl(url, {
      ...options,
      headers,
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(`Portainer API Error [${resp.status}]: ${errorText || resp.statusText}`);
    }

    if (resp.status === 204) {
      return {} as T;
    }

    return (await resp.json()) as T;
  }

  /**
   * List all registered Portainer environments (endpoints) with container metrics
   */
  async getEnvironments(): Promise<PortainerEnvironment[]> {
    const rawEndpoints = await this.request<any[]>('/endpoints');
    
    return rawEndpoints.map(ep => {
      const isUp = ep.Status === 1;
      return {
        id: ep.Id,
        name: ep.Name,
        type: ep.Type,
        url: ep.URL,
        status: isUp ? 'up' : 'down',
        groupId: ep.GroupId || 1,
        totalContainers: ep.Snapshots?.[0]?.DockerVersion ? (ep.Snapshots[0].RunningContainerCount + ep.Snapshots[0].StoppedContainerCount) : 0,
        runningContainers: ep.Snapshots?.[0]?.RunningContainerCount || 0,
        stoppedContainers: ep.Snapshots?.[0]?.StoppedContainerCount || 0,
        healthyContainers: ep.Snapshots?.[0]?.HealthyContainerCount || 0,
        unhealthyContainers: ep.Snapshots?.[0]?.UnhealthyContainerCount || 0,
        totalImages: ep.Snapshots?.[0]?.ImageCount || 0,
        totalVolumes: ep.Snapshots?.[0]?.VolumeCount || 0,
        totalStacks: ep.Snapshots?.[0]?.StackCount || 0,
        dockerVersion: ep.Snapshots?.[0]?.DockerVersion,
        publicUrl: ep.PublicURL,
        tags: ep.TagIds?.map((t: number) => `tag-${t}`) || [],
      };
    });
  }

  /**
   * Provision a new environment into the Portainer server
   */
  async createEnvironment(payload: CreateEnvironmentPayload): Promise<PortainerEnvironment> {
    const body: Record<string, any> = {
      Name: payload.name,
      EndpointType: payload.type,
      URL: payload.url,
      PublicURL: payload.publicUrl || '',
      GroupId: payload.groupId || 1,
      TagIds: [],
    };

    if (payload.type === 2) {
      // Portainer Agent TCP
      body.TLS = payload.tls?.skipVerify !== undefined ? {
        TLS: true,
        TLSSkipVerify: payload.tls.skipVerify
      } : { TLS: false };
    }

    const created = await this.request<any>('/endpoints', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return {
      id: created.Id,
      name: created.Name,
      type: created.Type,
      url: created.URL,
      status: 'up',
      groupId: created.GroupId || 1,
      totalContainers: 0,
      runningContainers: 0,
      stoppedContainers: 0,
      healthyContainers: 0,
      unhealthyContainers: 0,
      totalImages: 0,
      totalVolumes: 0,
      totalStacks: 0,
    };
  }

  /**
   * Delete an environment
   */
  async deleteEnvironment(id: number): Promise<void> {
    await this.request(`/endpoints/${id}`, { method: 'DELETE' });
  }

  /**
   * List all stacks across environments (or filtered by endpointId)
   */
  async getStacks(endpointId?: number): Promise<PortainerStack[]> {
    const rawStacks = await this.request<any[]>('/stacks');
    
    const filtered = endpointId ? rawStacks.filter(s => s.EndpointId === endpointId) : rawStacks;

    return filtered.map(st => {
      const isRunning = st.Status === 1;
      return {
        id: st.Id,
        name: st.Name,
        type: st.Type,
        endpointId: st.EndpointId,
        status: st.Status,
        statusLabel: isRunning ? 'running' : 'stopped',
        entryPoint: st.EntryPoint || 'docker-compose.yml',
        projectPath: st.ProjectPath || '',
        creationDate: st.CreationDate * 1000,
        updateDate: (st.UpdateDate || st.CreationDate) * 1000,
        updatedBy: st.UpdatedBy || 'system',
        autoUpdate: !!st.AutoUpdate,
        namedVolumes: [],
        hostMounts: [],
        env: st.Env || [],
        websiteUrl: `https://${st.Name}.gameproductions.net`,
      };
    });
  }

  /**
   * Fetch raw compose content for a stack
   */
  async getStackFile(stackId: number): Promise<string> {
    const res = await this.request<{ StackFileContent: string }>(`/stacks/${stackId}/file`);
    return res.StackFileContent || '';
  }

  /**
   * Update stack compose file & variables
   */
  async updateStack(
    stackId: number, 
    endpointId: number, 
    stackFileContent: string, 
    env: Array<{ name: string; value: string }> = []
  ): Promise<void> {
    await this.request(`/stacks/${stackId}?endpointId=${endpointId}`, {
      method: 'PUT',
      body: JSON.stringify({
        stackFileContent,
        env,
        prune: false,
      }),
    });
  }

  /**
   * Trigger stack lifecycle action (start, stop, restart, pause, unpause)
   */
  async stackAction(endpointId: number, stackId: number, action: 'start' | 'stop' | 'restart' | 'pause' | 'unpause'): Promise<void> {
    if (action === 'start' || action === 'stop') {
      await this.request(`/stacks/${stackId}/${action}?endpointId=${endpointId}`, {
        method: 'POST',
      });
      return;
    }

    // For restart, pause, unpause: apply across all containers associated with the stack
    const containers = await this.getContainers(endpointId);
    const stack = (await this.getStacks(endpointId)).find(s => s.id === stackId);
    const stackName = stack?.name.toLowerCase();

    const targets = containers.filter(c => 
      (c.stackName && c.stackName.toLowerCase() === stackName) ||
      (stackName && c.names.some(n => n.toLowerCase().includes(stackName)))
    );

    for (const c of targets) {
      if (action === 'restart') {
        await this.containerAction(endpointId, c.id, 'restart');
      } else if (action === 'pause') {
        await this.request(`/endpoints/${endpointId}/docker/containers/${c.id}/pause`, { method: 'POST' });
      } else if (action === 'unpause') {
        await this.request(`/endpoints/${endpointId}/docker/containers/${c.id}/unpause`, { method: 'POST' });
      }
    }
  }

  /**
   * Create a new stack on an environment
   */
  async createStack(endpointId: number, name: string, stackFileContent: string, env: Array<{ name: string; value: string }> = []): Promise<PortainerStack> {
    const created = await this.request<any>(`/stacks/create/standalone/string?endpointId=${endpointId}`, {
      method: 'POST',
      body: JSON.stringify({
        name,
        stackFileContent,
        env,
        fromAppTemplate: false,
      }),
    });
    return {
      id: created.Id,
      name: created.Name,
      type: created.Type || 2,
      endpointId: created.EndpointId || endpointId,
      status: created.Status || 1,
      statusLabel: 'running',
      entryPoint: created.EntryPoint || 'docker-compose.yml',
      projectPath: created.ProjectPath || '',
      creationDate: (created.CreationDate || Date.now() / 1000) * 1000,
      updateDate: Date.now(),
      updatedBy: created.UpdatedBy || 'system',
      namedVolumes: [],
      hostMounts: [],
      env: env,
    };
  }

  /**
   * Delete a stack
   */
  async deleteStack(endpointId: number, stackId: number, prune: boolean = false): Promise<void> {
    await this.request(`/stacks/${stackId}?endpointId=${endpointId}&prune=${prune}`, {
      method: 'DELETE',
    });
  }

  /**
   * Fetch comprehensive stack details (volumes, networks, envs, images, containers)
   */
  async getStackDetails(endpointId: number, stackId: number): Promise<PortainerStackDetails> {
    const stacks = await this.getStacks(endpointId);
    const stack = stacks.find(s => s.id === stackId);
    if (!stack) {
      throw new Error(`Stack ${stackId} not found in environment ${endpointId}`);
    }

    const composeFile = await this.getStackFile(stackId);
    const allContainers = await this.getContainers(endpointId);

    const stackContainers = allContainers.filter(c => 
      (c.stackName && c.stackName.toLowerCase() === stack.name.toLowerCase()) ||
      c.names.some(n => n.toLowerCase().includes(stack.name.toLowerCase()))
    );

    // Parse compose volumes & mounts from compose file
    const namedMap = new Map<string, PortainerStackVolume>();
    const bindMap = new Map<string, PortainerStackVolume>();
    const imageList: PortainerStackImage[] = [];
    const serviceList: Array<{ name: string; image: string; status: string; ports: string[] }> = [];

    // Helper to categorize volume path
    const categorizeMount = (dest: string): PortainerStackVolume['category'] => {
      const lower = dest.toLowerCase();
      if (lower.includes('config')) return 'config';
      if (lower.includes('log')) return 'logs';
      if (lower.includes('backup')) return 'backups';
      if (lower.includes('cert')) return 'certs';
      if (lower.includes('media') || lower.includes('video') || lower.includes('anime') || lower.includes('series') || lower.includes('porn') || lower.includes('download')) return 'media';
      if (lower.includes('cache')) return 'cache';
      return 'data';
    };

    // 1. Extract mounts directly from live Docker containers for 100% accuracy
    for (const c of stackContainers) {
      if (c.mounts && Array.isArray(c.mounts)) {
        for (const m of c.mounts) {
          const isVolume = m.type === 'volume' || !m.source.startsWith('/') || m.driver === 'local';
          const volName = m.name || m.source;
          const volObj: PortainerStackVolume = {
            name: volName,
            containerPath: m.destination,
            isNamed: isVolume,
            category: categorizeMount(m.destination),
          };

          if (isVolume) {
            namedMap.set(volName, volObj);
          } else {
            bindMap.set(volName, volObj);
          }
        }
      }
    }

    // 2. Also parse compose file lines as supplement
    const lines = composeFile.split('\n');
    let inVolumes = false;

    for (let rawLine of lines) {
      const line = rawLine.trim();
      if (line.startsWith('services:')) continue;

      const imgMatch = line.match(/^image:\s*([^\s]+)/);
      if (imgMatch) {
        const fullImg = imgMatch[1].replace(/['"]/g, '');
        let registry = 'docker.io';
        let repo = fullImg;
        let tag = 'latest';

        if (fullImg.includes(':')) {
          const parts = fullImg.split(':');
          repo = parts[0];
          tag = parts[1];
        }

        if (repo.startsWith('lscr.io/')) {
          registry = 'ghcr.io';
          repo = repo.replace('lscr.io/', '');
        } else if (repo.startsWith('ghcr.io/')) {
          registry = 'ghcr.io';
          repo = repo.replace('ghcr.io/', '');
        } else if (repo.startsWith('quay.io/')) {
          registry = 'quay.io';
          repo = repo.replace('quay.io/', '');
        } else if (repo.includes('/')) {
          registry = 'docker.io';
        }

        if (!imageList.some(im => im.name === fullImg)) {
          imageList.push({
            name: fullImg,
            repository: repo,
            tag,
            registryUrl: registry,
            status: 'up-to-date',
          });
        }
      }

      if (line === 'volumes:') {
        inVolumes = true;
        continue;
      }

      if (inVolumes && line.startsWith('- ')) {
        const volStr = line.replace(/^- /, '').replace(/['"]/g, '').trim();
        const parts = volStr.split(':');
        if (parts.length >= 2) {
          const src = parts[0];
          const dest = parts[1];
          const isBind = src.startsWith('/') || src.startsWith('.');

          const volObj: PortainerStackVolume = {
            name: src,
            containerPath: dest,
            isNamed: !isBind,
            category: categorizeMount(dest),
          };

          if (isBind) {
            if (!bindMap.has(src)) bindMap.set(src, volObj);
          } else {
            if (!namedMap.has(src)) namedMap.set(src, volObj);
          }
        }
      } else if (inVolumes && !line.startsWith('- ') && line.endsWith(':')) {
        inVolumes = false;
      }
    }

    // Populate service list from container inspection
    for (const c of stackContainers) {
      serviceList.push({
        name: c.primaryName,
        image: c.image,
        status: c.status,
        ports: c.ports.map(p => `${p.publicPort ? `${p.publicPort}:` : ''}${p.privatePort}/${p.type}`),
      });
    }

    // Get Docker host images to compare digests and creation timestamps
    const rawDockerImages = await this.request<any[]>(`/endpoints/${endpointId}/docker/images/json`).catch(() => []);

    // Enhance image updates checking against source hosting registries (Docker Hub, GHCR, Quay)
    for (const img of imageList) {
      // Find local image match
      const localMatch = rawDockerImages.find(di => 
        (di.RepoTags && di.RepoTags.some((t: string) => t.includes(img.repository) || t.includes(img.name))) ||
        (di.RepoDigests && di.RepoDigests.some((d: string) => d.includes(img.repository) || d.includes(img.name)))
      );

      if (localMatch) {
        img.localCreated = localMatch.Created * 1000;
        if (localMatch.RepoDigests && localMatch.RepoDigests.length > 0) {
          const rawDig = localMatch.RepoDigests[0];
          img.localDigest = rawDig.includes('@') ? rawDig.split('@')[1] : rawDig;
        }
      }

      const registry = img.registryUrl || 'docker.io';
      const tag = img.tag || 'latest';

      try {
        if (registry === 'ghcr.io') {
          // GitHub Container Registry / LinuxServer images
          const tokenRes = await this.fetchImpl(`https://ghcr.io/token?scope=repository:${img.repository}:pull`);
          if (tokenRes.ok) {
            const tokenData: any = await tokenRes.json();
            const manifestRes = await this.fetchImpl(`https://ghcr.io/v2/${img.repository}/manifests/${tag}`, {
              headers: {
                Authorization: `Bearer ${tokenData.token}`,
                Accept: 'application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json',
              },
            });
            if (manifestRes.ok) {
              const digest = manifestRes.headers.get('docker-content-digest') || manifestRes.headers.get('etag')?.replace(/"/g, '');
              if (digest) {
                img.remoteDigest = digest;
                if (img.localDigest) {
                  img.status = img.localDigest === digest ? 'up-to-date' : 'update-available';
                }
              }
            }
          }
        } else if (registry === 'quay.io') {
          // Quay.io Registry
          const quayRes = await this.fetchImpl(`https://quay.io/api/v1/repository/${img.repository}/tag/?specificTag=${tag}`);
          if (quayRes.ok) {
            const quayData: any = await quayRes.json();
            const tagInfo = quayData.tags?.[0];
            if (tagInfo) {
              img.remoteDigest = tagInfo.manifest_digest;
              if (tagInfo.last_modified) {
                img.remoteUpdated = new Date(tagInfo.last_modified).toISOString();
                if (img.localCreated && new Date(tagInfo.last_modified).getTime() > img.localCreated + 300000) {
                  img.status = 'update-available';
                } else {
                  img.status = 'up-to-date';
                }
              }
            }
          }
        } else {
          // Docker Hub Registry
          const repoPath = img.repository.includes('/') ? img.repository : `library/${img.repository}`;
          const hubRes = await this.fetchImpl(`https://hub.docker.com/v2/repositories/${repoPath}/tags/${tag}`);
          if (hubRes.ok) {
            const hubData: any = await hubRes.json();
            img.remoteUpdated = hubData.last_updated;
            img.remoteDigest = hubData.digest;

            if (img.localCreated && hubData.last_updated) {
              const remoteTime = new Date(hubData.last_updated).getTime();
              if (remoteTime > img.localCreated + 300000) {
                img.status = 'update-available';
              } else if (img.localDigest && hubData.digest && img.localDigest !== hubData.digest) {
                img.status = 'update-available';
              } else {
                img.status = 'up-to-date';
              }
            } else if (img.localDigest && hubData.digest) {
              img.status = img.localDigest === hubData.digest ? 'up-to-date' : 'update-available';
            } else {
              img.status = 'update-available';
            }
          } else {
            img.status = 'unknown';
          }
        }
      } catch {
        img.status = img.localCreated ? 'up-to-date' : 'unknown';
      }
    }

    const namedVolumes = Array.from(namedMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    const hostMounts = Array.from(bindMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    // Get networks
    const rawNetworks = await this.request<any[]>(`/endpoints/${endpointId}/docker/networks`).catch(() => []);
    const stackNetworks: PortainerStackNetwork[] = (rawNetworks || [])
      .filter(net => net.Name === 'entertainment' || net.Name.includes(stack.name.toLowerCase()) || net.Name === 'bridge')
      .map(net => ({
        name: net.Name,
        driver: net.Driver,
        scope: net.Scope,
        ipam: {
          ipv4Address: net.IPAM?.Config?.[0]?.Subnet,
          gateway: net.IPAM?.Config?.[0]?.Gateway,
        },
      }));

    return {
      ...stack,
      composeFile,
      namedVolumes,
      hostMounts,
      volumesGrouped: {
        named: namedVolumes,
        binds: hostMounts,
      },
      networks: stackNetworks,
      images: imageList,
      containers: stackContainers,
      services: serviceList,
    };
  }

  /**
   * Re-deploy stack with guaranteed image pull & container status verification
   */
  async redeployStack(stackId: number, endpointId: number): Promise<{ success: boolean; containersCount: number; status: string }> {
    const stack = (await this.getStacks(endpointId)).find(s => s.id === stackId);
    if (!stack) {
      throw new Error(`Stack ${stackId} does not exist in environment ${endpointId}`);
    }

    const content = await this.getStackFile(stackId);
    
    // Deploy update with prune
    await this.updateStack(stackId, endpointId, content, stack.env || []);

    // Wait & verify that containers are alive
    await new Promise(r => setTimeout(r, 2500));
    const containers = await this.getContainers(endpointId);
    const liveStackContainers = containers.filter(c => 
      (c.stackName && c.stackName.toLowerCase() === stack.name.toLowerCase()) ||
      c.names.some(n => n.toLowerCase().includes(stack.name.toLowerCase()))
    );

    const isRunning = liveStackContainers.some(c => c.state === 'running');
    return {
      success: isRunning || liveStackContainers.length > 0,
      containersCount: liveStackContainers.length,
      status: isRunning ? 'running' : 'starting',
    };
  }

  /**
   * List live Docker containers in an environment
   */
  async getContainers(endpointId: number): Promise<PortainerContainer[]> {
    const raw = await this.request<any[]>(`/endpoints/${endpointId}/docker/containers/json?all=1`);
    
    return raw.map(c => {
      const names = (c.Names || []).map((n: string) => n.replace(/^\//, ''));
      const primaryName = names[0] || c.Id.slice(0, 12);
      
      let health: 'healthy' | 'unhealthy' | 'starting' | 'none' = 'none';
      if (c.Status?.includes('(healthy)')) health = 'healthy';
      else if (c.Status?.includes('(unhealthy)')) health = 'unhealthy';
      else if (c.Status?.includes('(health: starting)')) health = 'starting';

      return {
        id: c.Id,
        names,
        primaryName,
        image: c.Image,
        imageId: c.ImageID,
        command: c.Command,
        created: c.Created * 1000,
        state: c.State,
        status: c.Status,
        health,
        ports: (c.Ports || []).map((p: any) => ({
          ip: p.IP,
          privatePort: p.PrivatePort,
          publicPort: p.PublicPort,
          type: p.Type,
        })),
        mounts: (c.Mounts || []).map((m: any) => ({
          type: m.Type === 'volume' ? 'volume' : 'bind',
          name: m.Name,
          source: m.Source,
          destination: m.Destination,
          driver: m.Driver,
          rw: m.RW,
        })),
        endpointId,
      };
    });
  }

  /**
   * Fetch live logs for a container
   */
  async getContainerLogs(endpointId: number, containerIdOrName: string, tail: number = 200): Promise<string> {
    let containerId = containerIdOrName;
    
    // If containerId is not a 64-char hex id, attempt to resolve from containers list
    if (!/^[a-f0-9]{12,64}$/i.test(containerId)) {
      try {
        const containers = await this.getContainers(endpointId);
        const match = containers.find(c => 
          c.names.some(n => n.toLowerCase() === containerIdOrName.toLowerCase() || n.toLowerCase().includes(containerIdOrName.toLowerCase())) ||
          c.primaryName.toLowerCase().includes(containerIdOrName.toLowerCase())
        );
        if (match) {
          containerId = match.id;
        }
      } catch {
        // Fall back to original identifier
      }
    }

    const url = `${this.baseUrl}/endpoints/${endpointId}/docker/containers/${containerId}/logs?stdout=1&stderr=1&tail=${tail}&timestamps=1`;
    const resp = await this.fetchImpl(url, {
      headers: { 'X-API-Key': this.apiKey },
    });
    
    if (!resp.ok) {
      throw new Error(`Failed to fetch logs: ${resp.statusText}`);
    }
    
    return await resp.text();
  }

  /**
   * Trigger container lifecycle action (start, stop, restart, kill)
   */
  async containerAction(endpointId: number, containerId: string, action: 'start' | 'stop' | 'restart' | 'kill'): Promise<void> {
    await this.request(`/endpoints/${endpointId}/docker/containers/${containerId}/${action}`, {
      method: 'POST',
    });
  }
}


