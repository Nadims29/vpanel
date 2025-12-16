import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, Terminal, ExternalLink, CheckCircle2 } from 'lucide-react';
import { Button, Card, Spinner } from '@/components/ui';

interface DockerUnavailableProps {
  error?: string;
  loading?: boolean;
  onRetry: () => Promise<void>;
}

export function DockerUnavailable({ error, loading, onRetry }: DockerUnavailableProps) {
  const steps = [
    {
      title: 'Check if Docker is installed',
      description: 'Make sure Docker Desktop or Docker Engine is installed on your system.',
      command: 'docker --version',
    },
    {
      title: 'Start Docker daemon',
      description: 'Ensure the Docker daemon is running.',
      command: 'sudo systemctl start docker',
      alt: 'Or start Docker Desktop application',
    },
    {
      title: 'Check Docker socket permissions',
      description: 'Verify you have access to the Docker socket.',
      command: 'sudo chmod 666 /var/run/docker.sock',
    },
    {
      title: 'Test Docker connection',
      description: 'Verify Docker is responding to commands.',
      command: 'docker ps',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-center min-h-[60vh]"
    >
      <Card className="max-w-2xl w-full p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/20 mb-4">
            <AlertTriangle className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold text-dark-100 mb-2">
            Docker Environment Unavailable
          </h2>
          <p className="text-dark-400 max-w-md mx-auto">
            Unable to connect to the Docker daemon. Please follow the steps below to enable Docker functionality.
          </p>
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>

        <div className="space-y-4 mb-8">
          <h3 className="text-sm font-medium text-dark-300 uppercase tracking-wider">
            Troubleshooting Steps
          </h3>
          {steps.map((step, index) => (
            <div
              key={index}
              className="flex gap-4 p-4 bg-dark-800/50 rounded-lg border border-dark-700"
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center">
                <span className="text-sm font-medium text-dark-300">{index + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-dark-100 mb-1">{step.title}</h4>
                <p className="text-sm text-dark-400 mb-2">{step.description}</p>
                <div className="flex items-center gap-2 p-2 bg-dark-900 rounded font-mono text-sm">
                  <Terminal className="w-4 h-4 text-dark-500 flex-shrink-0" />
                  <code className="text-green-400 truncate">{step.command}</code>
                </div>
                {step.alt && (
                  <p className="text-xs text-dark-500 mt-2 italic">{step.alt}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={onRetry}
            disabled={loading}
            className="inline-flex items-center gap-2"
          >
            {loading ? (
              <Spinner size="sm" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {loading ? 'Checking...' : 'Retry Connection'}
          </Button>
          <Button
            variant="outline"
            as="a"
            href="https://docs.docker.com/get-docker/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Docker Installation Guide
          </Button>
        </div>

        <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="flex gap-3">
            <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-300 mb-1">Using Docker Desktop?</h4>
              <p className="text-sm text-blue-400/80">
                If you're using Docker Desktop on macOS or Windows, simply open the Docker Desktop 
                application and wait for it to start. The whale icon in your system tray should 
                show "Docker Desktop is running".
              </p>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
