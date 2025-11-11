import { DaprClient, CommunicationProtocolEnum, HttpMethod } from 'dapr-client';

const DAPR_HTTP_PORT = process.env.DAPR_HTTP_PORT || '3500';
const DAPR_GRPC_PORT = process.env.DAPR_GRPC_PORT || '50001';

class DaprClientService {
  private client: DaprClient | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize Dapr client in development mode
      this.client = new DaprClient({
        daprHost: 'localhost',
        daprPort: DAPR_GRPC_PORT,
        communicationProtocol: CommunicationProtocolEnum.GRPC
      });

      this.isInitialized = true;
      console.log('Dapr client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Dapr client:', error);
      // Fall back to HTTP-based communication
      this.client = null;
      this.isInitialized = false;
    }
  }

  async invokeBinding(bindingName: string, operation: string, data: any): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      if (this.client) {
        // Use Dapr client binding
        return await this.client.binding.send(bindingName, operation, data);
      } else {
        // Fall back to HTTP API
        const response = await fetch(`http://localhost:${DAPR_HTTP_PORT}/v1.0/bindings/${bindingName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            operation,
            data,
            metadata: {}
          }),
        });

        if (!response.ok) {
          throw new Error(`Binding request failed: ${response.statusText}`);
        }

        return await response.json();
      }
    } catch (error) {
      console.error('Dapr binding invocation failed:', error);
      throw error;
    }
  }

  async publishEvent(pubsubName: string, topicName: string, data: any): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      if (this.client) {
        // Use Dapr client pub/sub
        await this.client.pubsub.publish(pubsubName, topicName, data);
      } else {
        // Fall back to HTTP API
        const response = await fetch(`http://localhost:${DAPR_HTTP_PORT}/v1.0/publish/${pubsubName}/${topicName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          throw new Error(`Publish request failed: ${response.statusText}`);
        }
      }
    } catch (error) {
      console.error('Dapr publish failed:', error);
      throw error;
    }
  }

  async getState(storeName: string, key: string): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      if (this.client) {
        // Use Dapr client state store
        return await this.client.state.get(storeName, key);
      } else {
        // Fall back to HTTP API
        const response = await fetch(`http://localhost:${DAPR_HTTP_PORT}/v1.0/state/${storeName}/${key}`);

        if (!response.ok) {
          if (response.status === 404) {
            return null;
          }
          throw new Error(`State get request failed: ${response.statusText}`);
        }

        return await response.json();
      }
    } catch (error) {
      console.error('Dapr state get failed:', error);
      throw error;
    }
  }

  async setState(storeName: string, key: string, value: any): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      if (this.client) {
        // Use Dapr client state store
        await this.client.state.save(storeName, [{ key, value }]);
      } else {
        // Fall back to HTTP API
        const response = await fetch(`http://localhost:${DAPR_HTTP_PORT}/v1.0/state/${storeName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([{ key, value }]),
        });

        if (!response.ok) {
          throw new Error(`State save request failed: ${response.statusText}`);
        }
      }
    } catch (error) {
      console.error('Dapr state save failed:', error);
      throw error;
    }
  }

  async invokeService(appId: string, methodName: string, data?: any, httpVerb: HttpMethod = HttpMethod.POST): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      if (this.client) {
        // Use Dapr client service invocation
        return await this.client.invoker.invoke(appId, methodName, httpVerb, data);
      } else {
        // Fall back to HTTP API
        const response = await fetch(`http://localhost:${DAPR_HTTP_PORT}/v1.0/invoke/${appId}/method/${methodName}`, {
          method: httpVerb,
          headers: {
            'Content-Type': 'application/json',
          },
          body: data ? JSON.stringify(data) : undefined,
        });

        if (!response.ok) {
          throw new Error(`Service invocation failed: ${response.statusText}`);
        }

        return await response.json();
      }
    } catch (error) {
      console.error('Dapr service invocation failed:', error);
      throw error;
    }
  }

  async getSecret(secretStoreName: string, key: string): Promise<string | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      if (this.client) {
        // Use Dapr client secrets
        const secrets = await this.client.secret.get(secretStoreName, key) as Record<string, string>;
        return secrets[key] || null;
      } else {
        // Fall back to HTTP API
        const response = await fetch(`http://localhost:${DAPR_HTTP_PORT}/v1.0/secrets/${secretStoreName}/${key}`);

        if (!response.ok) {
          if (response.status === 404) {
            return null;
          }
          throw new Error(`Secret get request failed: ${response.statusText}`);
        }

        const secrets = await response.json() as Record<string, string>;
        return secrets[key] || null;
      }
    } catch (error) {
      console.error('Dapr secret get failed:', error);
      throw error;
    }
  }

  isClientReady(): boolean {
    return this.isInitialized;
  }

  async dispose(): Promise<void> {
    if (this.client) {
      try {
        // Note: DaprClient doesn't have a close() method in the current SDK version
        // Connection cleanup is handled automatically
        this.client = null;
        this.isInitialized = false;
      } catch (error) {
        console.error('Error disposing Dapr client:', error);
      }
    }
  }
}

export const daprClient = new DaprClientService();