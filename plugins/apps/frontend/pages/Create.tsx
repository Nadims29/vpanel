import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Rocket,
  GitBranch,
  Key,
  FileCode,
  Settings,
  Globe,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button, Card, Input, Spinner } from '@/components/ui';
import toast from 'react-hot-toast';
import * as appsApi from '../api/apps';

export default function CreateApp() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [deployAfterCreate, setDeployAfterCreate] = useState(true);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [gitUrl, setGitUrl] = useState('');
  const [gitBranch, setGitBranch] = useState('main');
  const [gitToken, setGitToken] = useState('');
  const [dockerfilePath, setDockerfilePath] = useState('Dockerfile');
  const [buildContext, setBuildContext] = useState('.');
  const [port, setPort] = useState(3000);
  const [domain, setDomain] = useState('');
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([]);

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }]);
  };

  const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...envVars];
    updated[index][field] = value;
    setEnvVars(updated);
  };

  const removeEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('App name is required');
      return;
    }
    if (!gitUrl.trim()) {
      toast.error('Git URL is required');
      return;
    }

    setLoading(true);

    try {
      // Convert env vars array to object
      const envVarsObj: Record<string, string> = {};
      envVars.forEach(({ key, value }) => {
        if (key.trim()) {
          envVarsObj[key.trim()] = value;
        }
      });

      const app = await appsApi.createApp({
        name: name.trim(),
        description: description.trim(),
        git_url: gitUrl.trim(),
        git_branch: gitBranch.trim() || 'main',
        git_token: gitToken.trim() || undefined,
        dockerfile_path: dockerfilePath.trim() || 'Dockerfile',
        build_context: buildContext.trim() || '.',
        port: port || 3000,
        domain: domain.trim() || undefined,
        env_vars: Object.keys(envVarsObj).length > 0 ? envVarsObj : undefined,
      });

      toast.success('App created successfully');

      if (deployAfterCreate) {
        try {
          await appsApi.deployApp(app.id);
          toast.success('Deployment started');
        } catch {
          toast.error('Failed to start deployment');
        }
      }

      navigate(`/apps/${app.id}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('already exists')) {
        toast.error('An app with this name already exists');
      } else {
        toast.error('Failed to create app: ' + errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/apps')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-dark-100">Deploy from Git</h1>
          <p className="text-dark-400 mt-1">
            Deploy an application from a GitHub, GitLab, or other Git repository
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Rocket className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-dark-100">Application</h2>
              <p className="text-sm text-dark-400">Basic information about your app</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">
                App Name <span className="text-red-400">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-awesome-app"
                disabled={loading}
              />
              <p className="text-xs text-dark-400 mt-1">
                Lowercase letters, numbers, and hyphens only
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">
                Description
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of your app"
                disabled={loading}
              />
            </div>
          </div>
        </Card>

        {/* Git Configuration */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <GitBranch className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-dark-100">Git Repository</h2>
              <p className="text-sm text-dark-400">Source code repository settings</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">
                Git URL <span className="text-red-400">*</span>
              </label>
              <Input
                value={gitUrl}
                onChange={(e) => setGitUrl(e.target.value)}
                placeholder="https://github.com/user/repo.git"
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-1">
                  Branch
                </label>
                <Input
                  value={gitBranch}
                  onChange={(e) => setGitBranch(e.target.value)}
                  placeholder="main"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-1">
                  <Key className="w-3 h-3 inline mr-1" />
                  Access Token
                </label>
                <Input
                  type="password"
                  value={gitToken}
                  onChange={(e) => setGitToken(e.target.value)}
                  placeholder="ghp_... (for private repos)"
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Build Configuration */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <FileCode className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-dark-100">Build Settings</h2>
              <p className="text-sm text-dark-400">Docker build configuration</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-1">
                  Dockerfile Path
                </label>
                <Input
                  value={dockerfilePath}
                  onChange={(e) => setDockerfilePath(e.target.value)}
                  placeholder="Dockerfile"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-1">
                  Build Context
                </label>
                <Input
                  value={buildContext}
                  onChange={(e) => setBuildContext(e.target.value)}
                  placeholder="."
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">
                Port
              </label>
              <Input
                type="number"
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value) || 3000)}
                placeholder="3000"
                disabled={loading}
              />
              <p className="text-xs text-dark-400 mt-1">
                The port your application listens on inside the container
              </p>
            </div>
          </div>
        </Card>

        {/* Environment Variables */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Settings className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-medium text-dark-100">Environment Variables</h2>
                <p className="text-sm text-dark-400">Configure runtime environment</p>
              </div>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={addEnvVar}>
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>

          {envVars.length === 0 ? (
            <p className="text-sm text-dark-400 text-center py-4">
              No environment variables configured
            </p>
          ) : (
            <div className="space-y-2">
              {envVars.map((env, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={env.key}
                    onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
                    placeholder="KEY"
                    className="flex-1"
                    disabled={loading}
                  />
                  <span className="text-dark-400">=</span>
                  <Input
                    value={env.value}
                    onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                    placeholder="value"
                    className="flex-1"
                    disabled={loading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeEnvVar(index)}
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Domain Configuration */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <Globe className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-dark-100">Domain (Optional)</h2>
              <p className="text-sm text-dark-400">Configure a custom domain for your app</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-1">
              Domain Name
            </label>
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="myapp.example.com"
              disabled={loading}
            />
            <p className="text-xs text-dark-400 mt-1">
              A reverse proxy will be automatically configured via Nginx
            </p>
          </div>
        </Card>

        {/* Actions */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={deployAfterCreate}
                onChange={(e) => setDeployAfterCreate(e.target.checked)}
                className="w-4 h-4 rounded border-dark-600 bg-dark-700 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-dark-200">
                Start deployment immediately after creation
              </span>
            </label>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate('/apps')}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4 mr-2" />
                    Create App
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
}
