import { useState, useEffect, useCallback } from 'react';
import { checkDockerStatus, DockerInfo } from '@/api/docker';

export interface DockerStatus {
  available: boolean;
  loading: boolean;
  info?: DockerInfo;
  error?: string;
  refetch: () => Promise<void>;
}

export function useDockerStatus(): DockerStatus {
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<DockerInfo | undefined>();
  const [error, setError] = useState<string | undefined>();

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const result = await checkDockerStatus();
      setAvailable(result.available);
      setInfo(result.info);
      setError(result.error);
    } catch (err) {
      setAvailable(false);
      setError(err instanceof Error ? err.message : 'Failed to check Docker status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    available,
    loading,
    info,
    error,
    refetch: fetchStatus,
  };
}
