import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Download, Trash2, RefreshCw } from 'lucide-react';
import {
  Button,
  Badge,
  SearchInput,
  Modal,
  ConfirmModal,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  Empty,
  Spinner,
  Input,
} from '@/components/ui';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';
import * as dockerApi from '@/api/docker';
import type { Image } from '@/api/docker';

export default function DockerImages() {
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [showPullModal, setShowPullModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<Image | null>(null);
  const [pullImageName, setPullImageName] = useState('');
  const [pulling, setPulling] = useState(false);

  // Fetch images
  const fetchImages = useCallback(async () => {
    try {
      const data = await dockerApi.listImages();
      setImages(data);
    } catch (error) {
      console.error('Failed to fetch images:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to fetch images');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  // Handle pull image
  const handlePullImage = async () => {
    if (!pullImageName.trim()) {
      toast.error('Please enter an image name');
      return;
    }

    setPulling(true);
    try {
      await dockerApi.pullImage(pullImageName.trim());
      toast.success(`Successfully pulled image: ${pullImageName}`);
      setShowPullModal(false);
      setPullImageName('');
      fetchImages();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to pull image');
    } finally {
      setPulling(false);
    }
  };

  // Handle delete image
  const handleDeleteImage = async () => {
    if (!selectedImage) return;

    try {
      await dockerApi.removeImage(selectedImage.id, false);
      toast.success('Image deleted successfully');
      setShowDeleteModal(false);
      setSelectedImage(null);
      fetchImages();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete image');
    }
  };

  // Format size
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Parse repository and tag from image tag string
  const parseImageTag = (tag: string): { repository: string; tag: string } => {
    if (!tag || tag === '<none>:<none>') {
      return { repository: '<none>', tag: '<none>' };
    }
    const parts = tag.split(':');
    if (parts.length === 1) {
      return { repository: parts[0], tag: 'latest' };
    }
    const tagPart = parts.pop() || 'latest';
    return { repository: parts.join(':'), tag: tagPart };
  };

  // Filter images
  const filteredImages = images.filter((image) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return image.tags.some((tag) => tag.toLowerCase().includes(searchLower)) ||
           image.id.toLowerCase().includes(searchLower);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-dark-100">Images</h1>
          <p className="text-dark-400">Manage Docker images</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            leftIcon={<RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />}
            onClick={() => {
              setRefreshing(true);
              fetchImages();
            }}
            disabled={refreshing}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={() => setShowPullModal(true)}
          >
            Pull Image
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <SearchInput
          placeholder="Search images..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Images table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card overflow-hidden"
      >
        {filteredImages.length === 0 ? (
          <Empty
            title="No images found"
            description={search ? "Try adjusting your search" : "Pull an image to get started"}
            icon={<Download className="w-8 h-8 text-dark-500" />}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell>Repository</TableCell>
                <TableCell>Tag</TableCell>
                <TableCell>Image ID</TableCell>
                <TableCell>Size</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredImages.map((image) => {
                // If image has tags, show each tag as a row
                // Otherwise show the image ID
                const tags = image.tags.length > 0 ? image.tags : ['<none>:<none>'];
                
                return tags.map((tag, tagIndex) => {
                  const { repository, tag: tagName } = parseImageTag(tag);
                  const isFirstTag = tagIndex === 0;
                  
                  return (
                    <TableRow key={`${image.id}-${tagIndex}`}>
                      {isFirstTag ? (
                        <>
                          <TableCell className="font-medium text-dark-100">
                            {repository}
                          </TableCell>
                          <TableCell>
                            <Badge variant="primary">{tagName}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm text-dark-400">
                            {image.id}
                          </TableCell>
                          <TableCell className="text-dark-400">
                            {formatSize(image.size)}
                          </TableCell>
                          <TableCell className="text-dark-400">
                            {image.created}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                leftIcon={<Trash2 className="w-4 h-4" />}
                                onClick={() => {
                                  setSelectedImage(image);
                                  setShowDeleteModal(true);
                                }}
                                className="text-red-400 hover:text-red-300"
                              >
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="font-medium text-dark-100">
                            {repository}
                          </TableCell>
                          <TableCell>
                            <Badge variant="primary">{tagName}</Badge>
                          </TableCell>
                          <TableCell colSpan={4} className="text-dark-400 text-sm">
                            Same image as above
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  );
                });
              })}
            </TableBody>
          </Table>
        )}
      </motion.div>

      {/* Pull Image Modal */}
      <Modal
        open={showPullModal}
        onClose={() => {
          setShowPullModal(false);
          setPullImageName('');
        }}
        title="Pull Image"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Image Name</label>
            <Input
              placeholder="e.g., nginx:latest, mysql:8.0"
              value={pullImageName}
              onChange={(e) => setPullImageName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handlePullImage();
                }
              }}
            />
            <p className="text-sm text-dark-500 mt-1">
              Enter the full image name with optional tag (default: latest)
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setShowPullModal(false);
                setPullImageName('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handlePullImage}
              disabled={pulling || !pullImageName.trim()}
              leftIcon={pulling ? <Spinner size="sm" /> : <Download className="w-4 h-4" />}
            >
              {pulling ? 'Pulling...' : 'Pull Image'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedImage(null);
        }}
        onConfirm={handleDeleteImage}
        type="danger"
        title="Delete Image"
        message={
          selectedImage
            ? `Are you sure you want to delete image "${selectedImage.tags[0] || selectedImage.id}"? This action cannot be undone.`
            : ''
        }
        confirmText="Delete"
      />
    </div>
  );
}
